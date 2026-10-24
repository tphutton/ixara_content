import { validateHistoryArgs, validateHistoryLink } from "@/lib/social/history-reconciliation";
import {campaignOperations} from './campaigns';
import {campaignChangeRequest} from '@/lib/campaigns/client';
import {createActionLog} from '@/lib/actions/action-log';
import { prisma } from '@/lib/prisma';
import { contentOpsTools, executeContentOpsTool } from '@/lib/ai/tools';
import { requestEditorialApproval, decideEditorialApproval, revokeEditorialApproval, getEditorialApprovalHistory } from '@/lib/approvals/editorial-approvals';
import { listEditorialActivity } from '@/lib/editorial/record-history';
import { createEngine, McpError, type Operation } from './engine';

const reads = new Set(['list_content','list_blogs','list_schedule_entries','get_dashboard_summary','list_assets',
 'recommend_assets_for_content','list_brand_profiles','get_brand_profile','list_campaigns',
 'list_connected_accounts','list_published_posts','get_top_performing_posts','get_performance_insights',
 'get_meta_publishing_readiness','list_automations','get_automation_health','list_content_plans','get_quality_summary','get_production_status']);
const writes = new Set(['create_content','update_content','create_blog','update_blog','create_schedule_entry',
 'update_schedule_entry','upsert_brand_profile','create_content_plan','add_content_plan_item','promote_content_plan_item',
 'update_video_brief','add_editorial_comment','resolve_editorial_comment']);
const models: Record<string,string> = {content:'content',blog:'blog',schedule:'contentSchedule',plan:'contentPlan',
 plan_item:'contentPlanItem',variant:'contentVariant',brand:'brandProfile',asset:'asset',video_brief:'videoBrief'};
const targetModels: Record<string,string> = {content:'content',blog:'blog',schedule:'contentSchedule',content_plan:'contentPlan',
 content_plan_item:'contentPlanItem',content_variant:'contentVariant'};
const objectSchema=(properties:any,required:string[]=[])=>({type:'object',properties,required,additionalProperties:false});
const string={type:'string'};
async function actor(id:string) {
  // A separate non-login identity; never overwrite or elevate an existing human/Atlas account.
  const clerkUserId=`mcp:${id}`;
  const access=await prisma.userAccess.upsert({where:{clerkUserId},update:{},create:{clerkUserId,
    email:'chatgpt-content-service@internal.ixara.tech',fullName:'ChatGPT — Ixara Content',role:'admin',approvalStatus:'approved'}});
  if(access.role!=='admin'||access.approvalStatus!=='approved')throw new McpError(403,'The Content MCP actor is disabled.');
  return access;
}
async function snapshot(name:string,args:any,tx:any) {
  const mapping: Record<string,[string,string]>={update_content:['content','id'],update_blog:['blog','id'],
    update_schedule_entry:['contentSchedule','id'],add_content_plan_item:['contentPlan','planId'],
    promote_content_plan_item:['contentPlanItem','planItemId'],
    resolve_editorial_comment:['editorialComment','commentId']};
  const target=mapping[name];
  const record=target&&args[target[1]]?await tx[target[0]].findUniqueOrThrow({where:{id:args[target[1]]}}):null;
  // Brand defaults are inputs to the saved preview too.
  const brand=args.brand??record?.brand;
  const profile=brand?await tx.brandProfile.findFirst({where:{brandName:{equals:brand,mode:'insensitive'}}}):null;
  const brands=name==='upsert_brand_profile'?await tx.brandProfile.findMany({orderBy:{id:'asc'}}):null;
  const video=name==='update_video_brief'?await tx.videoBrief.findUniqueOrThrow({where:{planItemId:args.planItemId},include:{shots:true}}):null;
  const history = name === "update_schedule_entry" && (args.publishedPostId !== undefined || args.historyNote !== undefined) ? {
    posts: await tx.publishedPost.findMany({ where: { scheduleId: args.id }, orderBy: { id: "asc" } }),
    evidence: args.publishedPostId ? await tx.publishedPost.findUniqueOrThrow({ where: { id: args.publishedPostId }, include: { content: { select: { brand: true } }, blog: { select: { brand: true } }, connectedAccount: { select: { externalAccountId: true, brandName: true, brandProfile: { select: { brandName: true } } } } } }) : null,
  } : null;
  return {record,profile,brands,video,history};
}
async function guard(name:string,args:any,tx:any) {
  if (name === "update_schedule_entry" && (args.publishedPostId !== undefined || args.historyNote !== undefined)) {
    validateHistoryArgs(args);
    const schedule = await tx.contentSchedule.findUniqueOrThrow({ where: { id: args.id }, include: { publishedPosts: { select: { id: true } } } });
    if (schedule.status !== "published") throw new McpError(409, "Historical reconciliation requires an already-published schedule.");
    if (args.publishedPostId) {
      const post = await tx.publishedPost.findUniqueOrThrow({ where: { id: args.publishedPostId }, include: { content: { select: { brand: true } }, blog: { select: { brand: true } }, connectedAccount: { select: { externalAccountId: true, brandName: true, brandProfile: { select: { brandName: true } } } } } });
      validateHistoryLink(schedule, post);
    }
    return;
  }
  const forbidden=new Set(['approved','ready','published','queued','generating','completed']);
  const inspect=(value:any)=>{if(value&&typeof value==='object')for(const [key,v] of Object.entries(value)){
    if(key==='status'&&typeof v==='string'&&forbidden.has(v))throw new McpError(403,'Use the dedicated approval/production workflow for this status.');
    if(v&&typeof v==='object')inspect(v);
  }};inspect(args);
  if(name==='update_video_brief'){const brief=await tx.videoBrief.findUniqueOrThrow({where:{planItemId:args.planItemId}});if(forbidden.has(brief.status))throw new McpError(409,'Return the video brief to review before editing.');}
  const map:Record<string,string>={update_content:'content',update_blog:'blog',update_schedule_entry:'contentSchedule',update_video_brief:'videoBrief'};
  if(map[name]&&args.id){const row=await tx[map[name]].findUniqueOrThrow({where:{id:args.id}});
    if(forbidden.has(row.status))throw new McpError(409,'Revoke approval or return this record to review before editing.');}
}
const operations:Operation[]=(contentOpsTools as any[]).flatMap(def=>{
 const f=def.function;if(!reads.has(f.name)&&!writes.has(f.name))return [];
 const mutating=writes.has(f.name);
 return [{name:f.name,description:f.description,inputSchema:f.parameters,scope:`ixara-content:${mutating?'write':'read'}`,mutating,
   guard:mutating?(args:any,tx:any)=>guard(f.name,args,tx):undefined,
   snapshot:mutating?(args:any,tx:any)=>snapshot(f.name,args,tx):undefined,
   run:async(args:any,access:any)=>executeContentOpsTool(f.name,{...args,...('limit' in (f.parameters.properties||{})?{limit:Math.min(Math.max(Number(args.limit)||30,1),f.name === "list_published_posts" ? 500 : 100)}:{})},{access})}];
});
operations.push({name:'get_record',description:'Read a complete Content record, blog, plan, variant, brand, asset or video brief.',
 inputSchema:objectSchema({entity:{type:'string',enum:Object.keys(models)},id:string},['entity','id']),scope:'ixara-content:read',mutating:false,
 run:async args=>(prisma as any)[models[args.entity]].findUniqueOrThrow({where:{id:args.id},
 ...(args.entity==='plan'?{include:{items:true}}:args.entity==='video_brief'?{include:{shots:true}}:{})})});
const targetSchema=objectSchema({type:{type:'string',enum:Object.keys(targetModels)},id:string,comment:string},['type','id']);
operations.push({name:'get_editorial_activity',description:'Read editorial comments, versions and approvals.',
 inputSchema:targetSchema,scope:'ixara-content:read',mutating:false,
 run:async args=>({activity:await listEditorialActivity(args.type,args.id),approvals:await getEditorialApprovalHistory(args)})});
for(const name of ['request_editorial_approval','revoke_editorial_approval'])operations.push({name,
 description:name==='request_editorial_approval'?'Request editorial approval.':'Revoke approval and restore the existing review workflow.',inputSchema:targetSchema,
 scope:'ixara-content:approve',mutating:true,snapshot:async(args,tx)=>({record:await tx[targetModels[args.type]].findUniqueOrThrow({where:{id:args.id}}),approvals:await tx.editorialApproval.findMany({where:{targetType:args.type,targetId:args.id},orderBy:{id:'asc'}})}),
 run:async(args,access)=>name==='request_editorial_approval'?requestEditorialApproval({...args,access}):revokeEditorialApproval({...args,access})});
operations.push({name:'decide_editorial_approval',description:'Approve or reject an editorial request using the existing readiness and quality gates.',
 inputSchema:objectSchema({approvalId:string,decision:{type:'string',enum:['approved','rejected']},comment:string},['approvalId','decision']),
 scope:'ixara-content:approve',mutating:true,snapshot:async(args,tx)=>{const approval=await tx.editorialApproval.findUniqueOrThrow({where:{id:args.approvalId}});return {approval,record:await tx[targetModels[approval.targetType]].findUniqueOrThrow({where:{id:approval.targetId}})};},
 run:async(args,access)=>decideEditorialApproval({...args,access})});
operations.push(...campaignOperations({request:campaignChangeRequest,log:createActionLog,links:async campaign=>{
 const name=campaign.campaign_name;
 const [content,schedule,plans,items,assets]=await Promise.all([
  prisma.content.findMany({where:{campaignName:name},select:{id:true,title:true},take:100}),
  prisma.contentSchedule.findMany({where:{campaignName:name},select:{id:true},take:100}),
  prisma.contentPlan.findMany({where:{campaignName:name},select:{id:true},take:100}),
  prisma.contentPlanItem.findMany({where:{campaignName:name},select:{id:true},take:100}),
  prisma.campaignAsset.findMany({where:{campaignId:campaign.campaign_id},select:{assetId:true,role:true},take:100}),
 ]);return {content,schedule,plans,plan_items:items,assets,reference_note:'Content references currently use campaign names; campaign asset links use IDs.'};
}}));
const scopes=['ixara-content:read',...(process.env.IXARA_MCP_WRITE_ENABLED==='true'?['ixara-content:write','ixara-content:approve']:[])];
export const handleMcp=createEngine(prisma,operations,{name:'Ixara Content',scopes,actor});
