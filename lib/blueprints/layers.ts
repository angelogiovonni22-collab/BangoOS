import type { SupabaseClient } from "@supabase/supabase-js";

export type BlueprintLayer = { id:string; name:string; discipline:string; color:string; sortOrder:number };
const layers = (supabase:SupabaseClient) => (supabase as unknown as { from:(table:string)=>ReturnType<SupabaseClient["from"]> }).from("blueprint_layers");

export async function loadBlueprintLayers(supabase:SupabaseClient, companyId:string, projectId:string) {
  const response = await layers(supabase).select("id, name, discipline, color, sort_order").eq("company_id",companyId).eq("project_id",projectId).order("sort_order").order("name");
  if (response.error) throw response.error;
  return ((response.data??[]) as Array<Record<string,unknown>>).map((row)=>({id:String(row.id),name:String(row.name),discipline:String(row.discipline),color:String(row.color),sortOrder:Number(row.sort_order)} satisfies BlueprintLayer));
}

export async function createBlueprintLayer(supabase:SupabaseClient,input:{companyId:string;projectId:string;userId:string;name:string;discipline:string;color:string}) {
  const response=await layers(supabase).insert({company_id:input.companyId,project_id:input.projectId,created_by:input.userId,name:input.name.trim(),discipline:input.discipline,color:input.color});
  if(response.error) throw response.error;
}
