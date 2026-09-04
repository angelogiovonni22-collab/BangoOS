export type RealityCaptureType = "roomplan" | "arkit_mesh" | "webxr" | "photogrammetry";
export type RealitySourcePlatform = "ios" | "ipados" | "web";

export type RealityVector3 = { x:number; y:number; z:number };
export type RealityDimension = { width?:number; height?:number; length?:number; area?:number; volume?:number };

export type RoomPlanElement = {
  id:string;
  category:string;
  dimensions:RealityDimension;
  transform?:number[];
};

export type RoomPlanCapturePayload = {
  schemaVersion:1;
  capturedAt:string;
  roomIdentifier?:string;
  dimensions?:RealityDimension;
  walls:RoomPlanElement[];
  doors:RoomPlanElement[];
  windows:RoomPlanElement[];
  openings:RoomPlanElement[];
  objects:RoomPlanElement[];
};

export type RealityCaptureCreateInput = {
  projectId:string;
  blueprintVersionId?:string|null;
  captureType:RealityCaptureType;
  sourcePlatform:RealitySourcePlatform;
  deviceModel?:string|null;
  osVersion?:string|null;
  appBuild?:string|null;
  roomPlan?:RoomPlanCapturePayload|null;
  spatialSummary?:Record<string,unknown>;
  capturedAt?:string;
};

export function validateRealityCaptureInput(input:RealityCaptureCreateInput):string[] {
  const errors:string[]=[];
  if(!input.projectId?.trim()) errors.push("projectId is required");
  if(!["roomplan","arkit_mesh","webxr","photogrammetry"].includes(input.captureType)) errors.push("captureType is invalid");
  if(!["ios","ipados","web"].includes(input.sourcePlatform)) errors.push("sourcePlatform is invalid");
  if(input.captureType === "roomplan" && !input.roomPlan) errors.push("roomPlan payload is required for RoomPlan captures");
  if(input.roomPlan && input.roomPlan.schemaVersion !== 1) errors.push("Unsupported RoomPlan schema version");
  return errors;
}

export function summarizeRoomPlan(payload:RoomPlanCapturePayload):Record<string,unknown> {
  return {
    schemaVersion:payload.schemaVersion,
    dimensions:payload.dimensions ?? {},
    wallCount:payload.walls.length,
    doorCount:payload.doors.length,
    windowCount:payload.windows.length,
    openingCount:payload.openings.length,
    objectCount:payload.objects.length,
  };
}
