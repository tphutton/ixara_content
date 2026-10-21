import { createHash, timingSafeEqual } from 'node:crypto';
import { withMcpTransaction } from './transaction';

export class McpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const json = (value: any): any => JSON.parse(JSON.stringify(value));
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const digest = (value: any) => createHash('sha256').update(JSON.stringify(canonical(json(value)))).digest('hex');
export function authenticate(request: Request, env: Record<string,string|undefined> = process.env) {
  const expected = env.IXARA_MCP_ADMIN_KEY || '';
  if (env.IXARA_MCP_ENABLED !== 'true' || expected.length < 32) throw new McpError(503, 'MCP access is not configured.');
  const supplied = request.headers.get('x-ixara-mcp-key') || '';
  if (Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) throw new McpError(401, 'Dedicated MCP credential required.');
  return {id: env.IXARA_MCP_ACTOR_ID || 'chatgpt-owner'};
}
export function validate(schema: any, value: any, path = 'args', depth = 0): void {
  if (depth > 12) throw new McpError(400, 'Input is too deeply nested.');
  if (schema.enum && !schema.enum.includes(value)) throw new McpError(400, `${path}: unsupported value.`);
  if(schema.anyOf){if(!schema.anyOf.some((child:any)=>{try{validate(child,value,path,depth+1);return true;}catch{return false;}}))throw new McpError(400,`${path}: unsupported value.`);return;}
  const type = schema.type;
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new McpError(400, `${path}: object required.`);
    for (const key of schema.required || []) if (value[key] === undefined) throw new McpError(400, `${path}.${key} is required.`);
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties || {}, key)) {
        if (schema.additionalProperties === false) throw new McpError(400, `${path}.${key} is not allowed.`);
      } else validate(schema.properties[key], child, `${path}.${key}`, depth + 1);
    }
  } else if (type === 'array') {
    if (!Array.isArray(value) || value.length > (schema.maxItems || 100)) throw new McpError(400, `${path}: bounded array required.`);
    value.forEach((v, i) => validate(schema.items || {}, v, `${path}[${i}]`, depth + 1));
  } else if (type && !((type === 'number' || type === 'integer') ? typeof value === 'number' && Number.isFinite(value) && (type !== 'integer' || Number.isInteger(value)) : typeof value === type)) {
    throw new McpError(400, `${path}: ${type} required.`);
  }
  if (typeof value === 'string' && value.length > 64000) throw new McpError(400, `${path}: text too long.`);
}
export type Operation = {name: string; description: string; inputSchema: any; scope: string; mutating: boolean;
  run: (args: any, actor: any) => Promise<any>; snapshot?: (args: any, tx: any) => Promise<any>;
  guard?: (args: any, tx: any) => Promise<void>;
  external?: {preview:(args:any,actor:any,key:string)=>Promise<any>;apply:(args:any,actor:any,preview:any)=>Promise<any>}};
export function createEngine(db: any, operations: Operation[], options: {name: string; scopes: string[]; actor?: (id: string) => Promise<any>; context?: (actor: any, run: () => Promise<any>) => Promise<any>}) {
  const find = (name: string) => {
    const op = operations.find(o => o.name === name);
    if (!op) throw new McpError(403, 'Operation is not available.');
    if (!options.scopes.includes(op.scope)) throw new McpError(403, 'Operation scope is disabled.');
    return op;
  };
  const transaction = (work: (tx: any) => Promise<any>) => db.$transaction(
    (tx: any) => withMcpTransaction(tx, () => work(tx)), {isolationLevel: 'Serializable', timeout: 30000});
  const execute = (op: Operation, args: any, actor: any) => options.context
    ? options.context(actor, () => op.run(args, actor)) : op.run(args, actor);
  return async (request: Request) => {
    const principal = authenticate(request);
    if (!process.env.DATABASE_URL) throw new McpError(503, 'Live database is not configured.');
    if (request.method === 'GET') {
      await db.$queryRaw`SELECT 1`;
      return {profile:{id:principal.id,name:options.name},scopes:options.scopes,operations:operations.filter(o=>options.scopes.includes(o.scope)).map(({run,snapshot,guard,external,...o})=>o)};
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 131072) throw new McpError(413, 'Request is too large.');
    let body: any; try {body=JSON.parse(raw);} catch {throw new McpError(400,'Invalid JSON.');}
    const actor = options.actor ? await options.actor(principal.id) : {...principal,requestId:typeof body.request_key==='string'?body.request_key:body.change_set_id};
    if (body.action === 'read') {
      const op=find(body.tool);if(op.mutating)throw new McpError(400,'Use preview and apply for changes.');
      const args=body.args || {};validate(op.inputSchema,args);
      if(op.guard)await op.guard(args,db);
      return execute(op,args,actor);
    }
    if (body.action === 'preview') {
      const op=find(body.tool);if(!op.mutating)throw new McpError(400,'Read operations do not need a preview.');
      const args=body.args || {};validate(op.inputSchema,args);
      const key=body.request_key;
      if(typeof key!=='string'||key.length<8||key.length>128)throw new McpError(400,'A request_key of 8–128 characters is required.');
      const requestHash=digest({tool:body.tool,args});
      const existing=await db.mcpChangeSet.findUnique({where:{actorId_requestKey:{actorId:principal.id,requestKey:key}}});
      if(existing){if(existing.requestHash!==requestHash)throw new McpError(409,'Request key was already used for different changes.');return existing;}
      let preview: any, base: any;
      const rollback = new Error('rollback-preview');
      if(op.external){
        if(op.guard)await op.guard(args,db);
        base=null;preview=json(await op.external.preview(args,actor,key));
      }else try {await transaction(async tx=>{
        if(op.guard)await op.guard(args,tx);
        base=json(op.snapshot?await op.snapshot(args,tx):null);
        preview=json(await execute(op,args,actor));
        throw rollback;
      });} catch(error){if(error!==rollback)throw error;}
      try {
        return await db.mcpChangeSet.create({data:{actorId:principal.id,requestKey:key,requestHash,tool:body.tool,argsJson:json(args),baseJson:{value:base},previewJson:preview,expiresAt:new Date(Date.now()+30*60000)}});
      } catch(error:any) {
        if(error.code!=='P2002')throw error;
        const saved=await db.mcpChangeSet.findUniqueOrThrow({where:{actorId_requestKey:{actorId:principal.id,requestKey:key}}});
        if(saved.requestHash!==requestHash)throw new McpError(409,'Request key conflict.');return saved;
      }
    }
    if (!['apply','status'].includes(body.action) || typeof body.change_set_id!=='string')throw new McpError(400,'Unsupported action.');
    if(body.action==='status')return db.mcpChangeSet.findFirstOrThrow({where:{id:body.change_set_id,actorId:principal.id}});
    return transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${body.change_set_id}, 0))::text`;
      const change=await tx.mcpChangeSet.findFirst({where:{id:body.change_set_id,actorId:principal.id}});
      if(!change)throw new McpError(404,'Change set not found.');
      const op=find(change.tool);
      if(change.appliedAt)return {change_set_id:change.id,applied:true,result:change.resultJson};
      if(change.expiresAt.getTime()<=Date.now())throw new McpError(409,'Preview expired. Create a new preview.');
      const args=change.argsJson;validate(op.inputSchema,args);
      if(op.guard)await op.guard(args,tx);
      const current=op.snapshot?await op.snapshot(args,tx):null;
      if(digest(current)!==digest(change.baseJson.value))throw new McpError(409,'Records changed since preview. Preview again.');
      const result=json(op.external?await op.external.apply(args,actor,change.previewJson):await execute(op,args,actor));
      await tx.mcpChangeSet.update({where:{id:change.id},data:{resultJson:result,appliedAt:new Date()}});
      return {change_set_id:change.id,applied:true,result};
    });
  };
}
export async function respond(run: () => Promise<any>) {
  try {return Response.json(await run(),{headers:{'Cache-Control':'no-store'}});}
  catch(error:any){const status=error instanceof McpError?error.status:error?.code==='P2034'?409:error?.code==='P2025'?404:400;
    // No database exception strings, credentials or provider responses leave this boundary.
    return Response.json({error:error instanceof McpError?error.message:status===409?'Concurrent change. Preview again.':status===404?'Record not found.':'The operation failed validation or is unavailable.'},{status,headers:{'Cache-Control':'no-store'}});}
}
