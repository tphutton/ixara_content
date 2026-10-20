import assert from 'node:assert/strict';
async function main(){Object.assign(process.env,{IXARA_MCP_ENABLED:'true',IXARA_MCP_WRITE_ENABLED:'true',IXARA_MCP_ADMIN_KEY:'x'.repeat(40)});
 const {prisma}=await import('../lib/prisma');const {handleMcp}=await import('../lib/mcp/adapter');const {ContentType}=await import('@prisma/client');
 const request=(body:any)=>new Request('https://content.test/api/external/mcp',{method:'POST',headers:{'x-ixara-mcp-key':'x'.repeat(40)},body:JSON.stringify(body)});
 const call=(body:any)=>handleMcp(request(body));
 const make={action:'preview',tool:'create_content',request_key:'integration-create',args:{title:'Integration draft',contentType:Object.values(ContentType)[0]}};
 const saved:any=await call(make);assert.equal(await prisma.content.count(),0);assert.equal(await prisma.contentActionLog.count(),0);
 assert.equal((await call(make)).id,saved.id);await assert.rejects(call({...make,args:{...make.args,title:'different'}}));
 const applied:any=await call({action:'apply',change_set_id:saved.id});assert(applied.applied);assert.equal(await prisma.content.count(),1);assert.equal(await prisma.contentActionLog.count(),1);
 await call({action:'apply',change_set_id:saved.id});assert.equal(await prisma.content.count(),1);assert.equal(await prisma.contentActionLog.count(),1);
 const row=await prisma.content.findFirstOrThrow();const edit:any=await call({action:'preview',tool:'update_content',request_key:'integration-edit',args:{id:row.id,title:'preview edit'}});
 assert.equal((await prisma.content.findUniqueOrThrow({where:{id:row.id}})).title,'Integration draft');
 await prisma.content.update({where:{id:row.id},data:{title:'human edit'}});await assert.rejects(call({action:'apply',change_set_id:edit.id}),(e:any)=>e.status===409);
 await assert.rejects(call({action:'preview',tool:'update_content',request_key:'integration-approve',args:{id:row.id,status:'approved'}}),(e:any)=>e.status===403);
 await call({action:'read',tool:'list_content',args:{}});console.log('Content PostgreSQL integration: rollback, audit rollback, idempotency, conflict, approval guard and read PASS');await prisma.$disconnect();}
main().catch(e=>{console.error(e);process.exit(1);});
