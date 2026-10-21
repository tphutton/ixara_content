import {McpError,digest,type Operation} from './engine';
const string={type:'string'};
const nullable={anyOf:[string,{enum:[null]}]};
const fields:any={campaign_name:string,brand:{type:'array',items:string,maxItems:100},
 start_date:nullable,end_date:nullable,campaign_description:nullable,featured_image_link:nullable,
 campaign_status:{type:'string',enum:['draft','active','completed','cancelled']},campaign_type:nullable,
 country:nullable,region:nullable,category:nullable,partner_id:nullable};
const object=(properties:any,required:string[]=[])=>({type:'object',properties,required,additionalProperties:false});
const actorId=(actor:any)=>actor.clerkUserId||actor.id;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Dependencies={request:(path:string,actor:string,body?:unknown,key?:string)=>Promise<any>;
 links:(campaign:any)=>Promise<any>;log:(input:any)=>Promise<any>};
export function campaignOperations(deps:Dependencies):Operation[]{
 const request=async(path:string,actor:any,body?:unknown,key?:string)=>{
  try{return await deps.request(path,actorId(actor),body,key);}
  catch(e:any){if(e.status===409)throw new McpError(409,'Campaign changed or preview expired. Read the campaign and preview again.');
   if(e.status===400)throw new McpError(400,'Campaign fields failed validation. Check dates, status, partner and image URL.');
   if(e.status===404)throw new McpError(404,'Campaign or change set not found.');
   throw new McpError(503,'Campaign editing is unavailable. Check the campaigns API configuration.');}
 };
 const checkId=(id:string)=>{if(!uuid.test(id))throw new McpError(400,'A valid campaign ID is required.');};
 const get:Operation={name:'get_campaign',description:'Read a campaign, its current edit version and linked Content records. Read this before editing.',scope:'ixara-content:read',mutating:false,
  inputSchema:object({campaign_id:string},['campaign_id']),run:async(args,actor)=>{
   checkId(args.campaign_id);const item=await request('/changes/records/'+args.campaign_id,actor);
   return {toolName:'get_campaign',summary:'Loaded campaign '+item.record.campaign_name,payload:{...item.record,version:item.version},links:await deps.links(item.record)};
  }};
 const writes=['create_campaign','update_campaign'].map(name=>{
  const update=name==='update_campaign';
  return {name,description:update?'Preview a partial campaign update. Omitted fields and asset links are preserved; use null to clear optional values. Renaming does not rename name-linked Content records.':'Preview a new campaign. Defaults to draft. This does not publish posts, schedule content or start advertising.',
   inputSchema:update?object({campaign_id:string,version:string,patch:object(fields)},['campaign_id','version','patch']):object({values:object(fields,['campaign_name'])},['values']),
   scope:'ixara-content:write',mutating:true,run:async()=>{throw new McpError(400,'Campaign writes require their saved external preview.');},
   external:{preview:async(args:any,actor:any,key:string)=>{
    if(update)checkId(args.campaign_id);
    const values=update?args.patch:args.values;
    if(!Object.keys(values).length)throw new McpError(400,'Supply at least one campaign field.');
    const change={entity:'campaigns',operation:update?'update':'create',...(update?{id:args.campaign_id,version:args.version}:{}),values};
    const saved=await request('/changes/preview',actor,{changes:[change]},'content-campaign:'+digest({key,tool:name}));
    const item=saved.preview?.[0];if(!saved.change_set_id||saved.preview.length!==1||item.entity!=='campaigns')throw new McpError(503,'Invalid campaign preview response.');
    return {provider:'tsadb-campaigns',change_set_id:saved.change_set_id,expires_at:saved.expires_at,before:item.before,after:item.after,changed_fields:item.changed_fields,
      warnings:item.before?.campaign_name&&item.before.campaign_name!==item.after.campaign_name?['Existing Content references use the previous campaign name and are not renamed automatically.']:[],
      linked_records:item.before?await deps.links(item.before):null};
   },apply:async(_args:any,actor:any,saved:any)=>{
    if(saved.provider!=='tsadb-campaigns'||!uuid.test(saved.change_set_id))throw new McpError(400,'Invalid saved campaign preview.');
    const result=await request('/changes/'+saved.change_set_id+'/apply',actor,{});
    const item=result.records?.[0];if(!result.applied||!item?.record?.campaign_id)throw new McpError(503,'Campaign application could not be confirmed. Retry this saved preview.');
    await deps.log({userId:actor.id,actionType:update?'update':'create',targetType:'campaign',targetId:item.record.campaign_id,
      summary:'ChatGPT '+(update?'updated':'created')+' campaign '+item.record.campaign_name,beforeData:saved.before,afterData:item.record,source:'mcp'});
    return {toolName:name,summary:(update?'Updated':'Created')+' campaign '+item.record.campaign_name,payload:{...item.record,version:item.version},campaign_change_set_id:saved.change_set_id};
   }}
  } as Operation;
 });return [get,...writes];
}
