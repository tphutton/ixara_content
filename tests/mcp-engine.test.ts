import {test} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine,authenticate,validate} from '../lib/mcp/engine';
import {scopedPrisma,withMcpTransaction} from '../lib/mcp/transaction';

test('transaction context isolates parallel callers and joins nested services',async()=>{
 const base={value:'base',$transaction:async(fn:any)=>fn({value:'tx'})};const client=scopedPrisma(base);
 const values=await Promise.all(['a','b'].map(value=>withMcpTransaction({value},async()=>{await Promise.resolve();assert.equal(client.value,value);return (client.$transaction as any)(async(tx:any)=>tx.value);})));assert.deepEqual(values,['a','b']);assert.equal(client.value,'base');
});
test('authentication and strict argument checks fail closed',()=>{
 assert.throws(()=>authenticate(new Request('https://app.test'),{}));
 assert.throws(()=>authenticate(new Request('https://app.test'),{IXARA_MCP_ENABLED:'true',IXARA_MCP_ADMIN_KEY:'x'.repeat(40)}));
 assert.throws(()=>validate({type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false},{name:'x',status:'approved'}));
});
// Transactional store models commit/rollback and exposes the original service delegate through ALS.
function fixture(operations?:any[]){let state:any={records:[],changes:[]};const make=(get:()=>any)=>({
 record:{create:async({data}:any)=>{const row={id:String(get().records.length+1),...data};get().records.push(row);return row;},findMany:async()=>get().records},
 mcpChangeSet:{findUnique:async({where}:any)=>get().changes.find((c:any)=>c.actorId===where.actorId_requestKey.actorId&&c.requestKey===where.actorId_requestKey.requestKey),findFirst:async({where}:any)=>get().changes.find((c:any)=>c.id===where.id&&c.actorId===where.actorId),findFirstOrThrow:async({where}:any)=>{const v=get().changes.find((c:any)=>c.id===where.id&&c.actorId===where.actorId);if(!v)throw Error('missing');return v;},create:async({data}:any)=>{const row={id:'change-'+get().changes.length,...data};get().changes.push(row);return row;},update:async({where,data}:any)=>Object.assign(get().changes.find((c:any)=>c.id===where.id),data)},$queryRaw:async()=>[]});
 const base:any=make(()=>state);base.$transaction=async(fn:any)=>{const draft=structuredClone(state),tx=make(()=>draft);const result=await fn(tx);state=draft;return result;};const db:any=scopedPrisma(base);
 const handler=createEngine(db,operations||[{name:'create',description:'create',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false},scope:'write',mutating:true,snapshot:async(_a,tx)=>tx.record.findMany(),run:async args=>db.$transaction((tx:any)=>tx.record.create({data:args}))}],{name:'Test',scopes:['write']});
 return {handler,db,state:()=>state};}
const req=(body:any)=>new Request('https://app.test/api/external/mcp',{method:'POST',headers:{'x-ixara-mcp-key':'x'.repeat(40)},body:JSON.stringify(body)});
test('preview rolls back nested service writes; durable retry and apply are idempotent; stale previews conflict',async()=>{
 process.env.IXARA_MCP_ENABLED='true';process.env.IXARA_MCP_ADMIN_KEY='x'.repeat(40);process.env.DATABASE_URL='test-only';const f=fixture();
 const body={action:'preview',tool:'create',args:{name:'A'},request_key:'request-123'};
 const saved=await f.handler(req(body));assert.equal(f.state().records.length,0);assert.equal(f.state().changes.length,1);
 assert.equal((await f.handler(req(body))).id,saved.id);
 await assert.rejects(f.handler(req({...body,args:{name:'B'}})),(e:any)=>e.status===409);
 const apply={action:'apply',change_set_id:saved.id};assert.equal((await f.handler(req(apply))).applied,true);await f.handler(req(apply));assert.equal(f.state().records.length,1);
 const next=await f.handler(req({...body,request_key:'request-456'}));await f.db.record.create({data:{name:'other'}});
 await assert.rejects(f.handler(req({action:'apply',change_set_id:next.id})),(e:any)=>e.status===409);assert.equal(f.state().records.length,2);
});

test('external preview never executes a write; remote commit and local rollback recover without duplicate provider writes',async()=>{
 process.env.IXARA_MCP_ENABLED='true';process.env.IXARA_MCP_ADMIN_KEY='x'.repeat(40);process.env.DATABASE_URL='test-only';
 let previews=0,remoteWrites=0,remoteSaved:any=null,failLocal=true,f:any;
 const operation={name:'campaign',description:'external',inputSchema:{type:'object',properties:{},additionalProperties:false},scope:'write',mutating:true,
  run:async()=>{throw Error('External writes must not use the local rollback path');},
  external:{preview:async()=>{previews++;return {externalId:'saved'};},apply:async()=>{
   if(!remoteSaved){remoteWrites++;remoteSaved={id:'remote-campaign'};}
   await f.db.record.create({data:remoteSaved});if(failLocal){failLocal=false;throw Error('Local audit failed');}return remoteSaved;
  }}};
 f=fixture([operation]);const p=await f.handler(req({action:'preview',tool:'campaign',args:{},request_key:'external-key'}));
 assert.equal(previews,1);assert.equal(remoteWrites,0);assert.equal(f.state().records.length,0);
 await f.handler(req({action:'preview',tool:'campaign',args:{},request_key:'external-key'}));assert.equal(previews,1);
 await assert.rejects(f.handler(req({action:'apply',change_set_id:p.id})));assert.equal(remoteWrites,1);assert.equal(f.state().records.length,0);
 assert.equal((await f.handler(req({action:'apply',change_set_id:p.id}))).result.id,'remote-campaign');
 await f.handler(req({action:'apply',change_set_id:p.id}));assert.equal(remoteWrites,1);assert.equal(f.state().records.length,1);
});
