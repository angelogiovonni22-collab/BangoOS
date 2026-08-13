export type SnapPoint = { x: number; y: number };
export type SnapResult = SnapPoint & { snapped: boolean; reason: "endpoint" | "axis" | "grid" | null };
export function snapBlueprintPoint(point: SnapPoint, start: SnapPoint, endpoints: SnapPoint[], options: { endpointThreshold?: number; axisThreshold?: number; gridSize?: number } = {}): SnapResult {
  const endpointThreshold = options.endpointThreshold ?? 0.015, axisThreshold = options.axisThreshold ?? 0.012, gridSize = options.gridSize ?? 0.01;
  const endpoint = endpoints.reduce<{ point: SnapPoint; distance: number } | null>((best, candidate) => { const distance = Math.hypot(candidate.x-point.x,candidate.y-point.y); return distance <= endpointThreshold && (!best || distance < best.distance) ? { point:candidate,distance } : best; }, null);
  if (endpoint) return { ...endpoint.point, snapped:true, reason:"endpoint" };
  if (Math.abs(point.x-start.x) <= axisThreshold) return { x:start.x,y:point.y,snapped:true,reason:"axis" };
  if (Math.abs(point.y-start.y) <= axisThreshold) return { x:point.x,y:start.y,snapped:true,reason:"axis" };
  return { x:Math.round(point.x/gridSize)*gridSize,y:Math.round(point.y/gridSize)*gridSize,snapped:true,reason:"grid" };
}
export function blueprintWallEndpoints(markups: Array<{ type:string; geometry:Record<string,unknown> }>, page:number) { return markups.filter((item)=>item.type==="wall"&&Number(item.geometry.page??1)===page).flatMap((item)=>[{x:Number(item.geometry.x1),y:Number(item.geometry.y1)},{x:Number(item.geometry.x2),y:Number(item.geometry.y2)}]).filter((point)=>Number.isFinite(point.x)&&Number.isFinite(point.y)); }
