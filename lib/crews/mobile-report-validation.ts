import type { MobileDailyReportDraft } from "./mobile-field-operations-types";
import { isFieldProductionValid } from "./field-production";

export function validateMobileDailyReport(draft:MobileDailyReportDraft):string[]{const errors:string[]=[];
  const hasContent=Boolean(draft.notes.trim()||draft.completedWork.trim()||draft.delays.trim()||draft.materialsUsed.trim()||draft.safetyObservations.trim()||draft.photos.length);
  if(!hasContent)errors.push("Add field activity, notes, safety information, materials, delays, or a photo before submitting.");
  if(draft.completedWork.trim()&&!isFieldProductionValid({activity:draft.completedWork,quantity:draft.productionQuantity,unit:draft.productionUnit,percentComplete:draft.productionPercentComplete}))errors.push("Completed work requires a valid quantity, unit, and percent complete.");
  if(draft.delays.trim()){const duration=Number(draft.delayDurationHours);if(!Number.isFinite(duration)||duration<=0)errors.push("Delay duration must be greater than zero.");if(!draft.delayImpact.trim())errors.push("Describe the delay's schedule or cost impact.");if(!draft.delayCorrectiveAction.trim())errors.push("Record the delay corrective action.");}
  if(draft.materialsUsed.trim()){const quantity=Number(draft.materialQuantity);if(!Number.isFinite(quantity)||quantity<=0)errors.push("Material quantity must be greater than zero.");if(!draft.materialUnit.trim())errors.push("Material unit is required.");if(!draft.materialSupplier.trim())errors.push("Material supplier is required.");}
  if(draft.safetyObservations.trim()){const attendees=Number(draft.safetyAttendees);if(!Number.isInteger(attendees)||attendees<0)errors.push("Safety attendees must be a whole number of zero or more.");if((["near_miss","incident"].includes(draft.safetyEventType)||["high","critical"].includes(draft.safetySeverity))&&!draft.safetyImmediateAction.trim())errors.push("Record the immediate action for serious safety events.");}
  return errors;
}
