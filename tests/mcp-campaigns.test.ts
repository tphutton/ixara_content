import {test} from 'vitest';
import assert from 'node:assert/strict';
import {campaignOperations} from '../lib/mcp/campaigns';
import {validate} from '../lib/mcp/engine';
const id='11111111-1111-4111-8111-111111111111',changeId='22222222-2222-4222-8222-222222222222';
test('campaign updates preserve omitted fields and assets; provider preview is read-only and apply logs actual results',async()=>{
 const calls:any[]=[],logs:any[]=[],actor={id:'local-user',clerkUserId:'mcp:owner'};
 const before={campaign_id:id,campaign_name:'Original',campaign_status:'active',brand:['StadioMate']};
 const operations=campaignOperations({links:async()=>({assets:[{assetId:'keep'}]}),log:async input=>logs.push(input),request:async(path,owner,body,key)=>{
  calls.push({path,owner,body,key});if(path.includes('/records/'))return {record:before,version:'42'};
  if(path.endsWith('/preview'))return {change_set_id:changeId,preview:[{entity:'campaigns',before,after:{...before,campaign_description:null},changed_fields:['campaign_description']}]};
  return {applied:true,records:[{record:{...before,campaign_description:null},version:'43'}]};
 }});
 const get=await operations[0].run({campaign_id:id},actor);assert.equal(get.payload.version,'42');assert.equal(get.links.assets[0].assetId,'keep');
 const op=operations.find(x=>x.name==='update_campaign')!,args={campaign_id:id,version:'42',patch:{campaign_description:null}};
 validate(op.inputSchema,args);const preview=await op.external!.preview(args,actor,'stable-key');
 const call=calls.at(-1);assert.equal(call.owner,'mcp:owner');assert.deepEqual(call.body.changes[0].values,{campaign_description:null});assert.equal(call.body.changes[0].version,'42');assert.equal(logs.length,0);
 assert.throws(()=>validate(op.inputSchema,{...args,patch:{linkedAssetId:'overwrite'}}));
 const result=await op.external!.apply(args,actor,preview);assert.equal(result.payload.version,'43');assert.deepEqual(result.payload.brand,['StadioMate']);assert.equal(result.payload.campaign_status,'active');assert.equal(logs.length,1);assert.equal(logs[0].targetId,id);
});
test('provider conflicts remain conflicts rather than reconnect errors',async()=>{
 const operations=campaignOperations({links:async()=>null,log:async()=>null,request:async()=>{throw {status:409};}});
 await assert.rejects(operations[0].run({campaign_id:id},{id:'owner'}),(e:any)=>e.status===409);
});
