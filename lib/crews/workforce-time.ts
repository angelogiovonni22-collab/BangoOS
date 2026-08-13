import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type RpcResult = { data: unknown; error: { message?: string } | null };
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult> };

export async function recordWorkforceTimeEvent(input:{employeeId:string;action:"clock_in"|"clock_out";projectId?:string|null;assignmentId?:string|null;notes?:string}) {
  const supabase=createClient();
  const workspace=await resolveWorkspaceContext(supabase);
  if(!supabase||!workspace.context) throw new Error(workspace.errorMessage||"Time tracking is unavailable.");
  const {data,error}=await (supabase as unknown as RpcClient).rpc("record_workforce_time_event",{p_company_id:workspace.context.companyId,p_employee_id:input.employeeId,p_action:input.action,p_project_id:input.projectId||null,p_assignment_id:input.assignmentId||null,p_notes:input.notes||null});
  if(error) throw new Error(error.message||"Unable to record time.");
  return data;
}
