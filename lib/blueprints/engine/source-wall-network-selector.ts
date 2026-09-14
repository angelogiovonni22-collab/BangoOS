import type { BosSourceWallFacePair } from "./source-wall-face-mask";

export type BosSourceWallNetworkComponentSummary = {
  componentId: string;
  pairCount: number;
  pairIds: string[];
  totalLengthMeters: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

export type BosSourceWallNetworkSelection = {
  wallFacePairs: BosSourceWallFacePair[];
  rejectedPairIds: string[];
  componentCount: number;
  retainedComponentCount: number;
  retainedComponents: BosSourceWallNetworkComponentSummary[];
  repetitiveArtifactCount: number;
  rejectedSideRailPairCount: number;
  totalRetainedLengthMeters: number;
  diagnostics: string[];
};

export type BosSourceWallNetworkOptions = {
  junctionToleranceMeters?: number;
  openingContinuityMeters?: number;
  collinearToleranceMeters?: number;
  minRetainedComponentLengthMeters?: number;
  relativeComponentLengthFloor?: number;
  rightSideRailMinXRatio?: number;
  sideRailMaxWidthRatio?: number;
  sideRailMinHeightRatio?: number;
  sideRailMinRightEdgeRatio?: number;
  sideRailSpineClusterMeters?: number;
  sideRailMinSpineLengthRatio?: number;
};

type MeterPair = BosSourceWallFacePair & { axisStart: number; axisEnd: number; fixedMeters: number };
type Component = { wallFacePairs: MeterPair[]; totalLength: number };

function toMeterPair(pair: BosSourceWallFacePair, pixelsPerMeterX: number, pixelsPerMeterY: number): MeterPair {
  const horizontal = pair.orientation === "horizontal";
  return { ...pair, axisStart: pair.startPixel / (horizontal ? pixelsPerMeterX : pixelsPerMeterY), axisEnd: pair.endPixel / (horizontal ? pixelsPerMeterX : pixelsPerMeterY), fixedMeters: pair.centerFixedPixel / (horizontal ? pixelsPerMeterY : pixelsPerMeterX) };
}
function intervalGap(a0: number, a1: number, b0: number, b1: number) { const left = Math.max(Math.min(a0,a1),Math.min(b0,b1)); const right = Math.min(Math.max(a0,a1),Math.max(b0,b1)); return left <= right ? 0 : left-right; }
function intervalsOverlap(a0:number,a1:number,b0:number,b1:number){ return Math.max(Math.min(a0,a1),Math.min(b0,b1)) <= Math.min(Math.max(a0,a1),Math.max(b0,b1)); }
function connected(a: MeterPair,b:MeterPair,junction:number,opening:number,collinear:number){ if(a.orientation===b.orientation) return Math.abs(a.fixedMeters-b.fixedMeters)<=collinear && intervalGap(a.axisStart,a.axisEnd,b.axisStart,b.axisEnd)<=opening; const h=a.orientation==="horizontal"?a:b; const v=a.orientation==="vertical"?a:b; const x=v.fixedMeters,y=h.fixedMeters; const hd=x<h.axisStart?h.axisStart-x:x>h.axisEnd?x-h.axisEnd:0; const vd=y<v.axisStart?v.axisStart-y:y>v.axisEnd?y-v.axisEnd:0; return Math.hypot(hd,vd)<=junction; }
function repetitiveShortParallel(candidate:MeterPair,pairs:readonly MeterPair[]){ if(candidate.lengthMeters>1.5)return false; let family=1; for(const other of pairs){ if(other.id===candidate.id||other.orientation!==candidate.orientation||other.lengthMeters>1.5)continue; const ratio=other.lengthMeters/Math.max(candidate.lengthMeters,.001); if(ratio<.62||ratio>1.62)continue; if(!intervalsOverlap(candidate.axisStart,candidate.axisEnd,other.axisStart,other.axisEnd))continue; if(Math.abs(candidate.fixedMeters-other.fixedMeters)>1.05)continue; family+=1; if(family>=4)return true;} return false; }
function componentBounds(component:Component){ let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity; for(const pair of component.wallFacePairs){ const a=Math.min(pair.axisStart,pair.axisEnd),b=Math.max(pair.axisStart,pair.axisEnd); if(pair.orientation==="horizontal"){minX=Math.min(minX,a);maxX=Math.max(maxX,b);minY=Math.min(minY,pair.fixedMeters);maxY=Math.max(maxY,pair.fixedMeters);}else{minX=Math.min(minX,pair.fixedMeters);maxX=Math.max(maxX,pair.fixedMeters);minY=Math.min(minY,a);maxY=Math.max(maxY,b);}} return {minX,minY,maxX,maxY}; }
function componentSummary(component:Component,index:number):BosSourceWallNetworkComponentSummary{ return {componentId:`source-component-${index+1}`,pairCount:component.wallFacePairs.length,pairIds:component.wallFacePairs.map(p=>p.id),totalLengthMeters:component.totalLength,bounds:componentBounds(component)}; }
function isRightSideRail(component:Component,input:{sourceWidthMeters:number;sourceHeightMeters:number;options?:BosSourceWallNetworkOptions}){
  const bounds=componentBounds(component), width=bounds.maxX-bounds.minX, height=bounds.maxY-bounds.minY;
  const minXRatio=input.options?.rightSideRailMinXRatio??.84, maxWidthRatio=input.options?.sideRailMaxWidthRatio??.15, minHeightRatio=input.options?.sideRailMinHeightRatio??.65, minRightEdgeRatio=input.options?.sideRailMinRightEdgeRatio??.95, cluster=input.options?.sideRailSpineClusterMeters??.20, minSpineRatio=input.options?.sideRailMinSpineLengthRatio??.50;
  if(bounds.minX<input.sourceWidthMeters*minXRatio||bounds.maxX<input.sourceWidthMeters*minRightEdgeRatio||width>input.sourceWidthMeters*maxWidthRatio||height<input.sourceHeightMeters*minHeightRatio)return false;
  const vertical=component.wallFacePairs.filter(pair=>pair.orientation==="vertical");
  let dominantSpineLength=0;
  for(const seed of vertical){ let sum=0; for(const pair of vertical)if(Math.abs(pair.fixedMeters-seed.fixedMeters)<=cluster)sum+=pair.lengthMeters; dominantSpineLength=Math.max(dominantSpineLength,sum); }
  return dominantSpineLength>=component.totalLength*minSpineRatio;
}

export function selectSourceWallNetwork(input:{wallFacePairs:readonly BosSourceWallFacePair[];sourcePixelWidth:number;sourcePixelHeight:number;sourceWidthMeters:number;sourceHeightMeters:number;options?:BosSourceWallNetworkOptions}):BosSourceWallNetworkSelection{
  const pixelsPerMeterX=input.sourcePixelWidth/input.sourceWidthMeters,pixelsPerMeterY=input.sourcePixelHeight/input.sourceHeightMeters;
  const junction=input.options?.junctionToleranceMeters??.28,opening=input.options?.openingContinuityMeters??1.2,collinear=input.options?.collinearToleranceMeters??.16,minComponent=input.options?.minRetainedComponentLengthMeters??4,relativeFloor=input.options?.relativeComponentLengthFloor??.12;
  const pairs=input.wallFacePairs.map(p=>toMeterPair(p,pixelsPerMeterX,pixelsPerMeterY));
  const repetitive=new Set(pairs.filter(p=>repetitiveShortParallel(p,pairs)).map(p=>p.id)); const structural=pairs.filter(p=>!repetitive.has(p.id));
  if(!structural.length)return{wallFacePairs:[],rejectedPairIds:pairs.map(p=>p.id),componentCount:0,retainedComponentCount:0,retainedComponents:[],repetitiveArtifactCount:repetitive.size,rejectedSideRailPairCount:0,totalRetainedLengthMeters:0,diagnostics:["Rendered-source wall network selector retained no building-scale wall-face pairs."]};
  const parent=structural.map((_,i)=>i); const find=(i:number):number=>{let c=i;while(parent[c]!==c){parent[c]=parent[parent[c]];c=parent[c];}return c;}; const union=(a:number,b:number)=>{const l=find(a),r=find(b);if(l!==r)parent[r]=l;};
  for(let l=0;l<structural.length;l++)for(let r=l+1;r<structural.length;r++)if(connected(structural[l],structural[r],junction,opening,collinear))union(l,r);
  const groups=new Map<number,MeterPair[]>(); structural.forEach((p,i)=>{const root=find(i);groups.set(root,[...(groups.get(root)||[]),p]);});
  const components=[...groups.values()].map(wallFacePairs=>({wallFacePairs,totalLength:wallFacePairs.reduce((s,p)=>s+p.lengthMeters,0)})).sort((a,b)=>b.totalLength-a.totalLength); const largest=components[0]?.totalLength||0;
  const scaleRetained=components.filter((c,i)=>i===0||(c.totalLength>=minComponent&&c.totalLength>=largest*relativeFloor));
  const rejectedSideRails=scaleRetained.filter(c=>isRightSideRail(c,input));
  const retained=scaleRetained.filter(c=>!isRightSideRail(c,input));
  const retainedIds=new Set(retained.flatMap(c=>c.wallFacePairs.map(p=>p.id))), sideRailIds=new Set(rejectedSideRails.flatMap(c=>c.wallFacePairs.map(p=>p.id)));
  const wallFacePairs=input.wallFacePairs.filter(p=>retainedIds.has(p.id)), totalRetainedLengthMeters=wallFacePairs.reduce((s,p)=>s+p.lengthMeters,0);
  return {wallFacePairs,rejectedPairIds:input.wallFacePairs.filter(p=>!retainedIds.has(p.id)).map(p=>p.id),componentCount:components.length,retainedComponentCount:retained.length,retainedComponents:retained.map(componentSummary),repetitiveArtifactCount:repetitive.size,rejectedSideRailPairCount:sideRailIds.size,totalRetainedLengthMeters,diagnostics:[`Rendered-source wall network retained ${wallFacePairs.length} of ${input.wallFacePairs.length} paired wall-face candidates across ${retained.length} of ${components.length} connected components.`,`Rendered-source wall network rejected ${repetitive.size} repetitive short parallel pairs before component selection.`,`Rendered-source wall network rejected ${sideRailIds.size} pair(s) belonging to source-only right-side title-block rails after component selection.`,`Right-side rail rejection requires a narrow component in the outer page band, at least 65% page-height span, and a dominant near-collinear vertical spine; no reconstructed candidate geometry is consulted.`,`Largest independent source-wall component spans ${largest.toFixed(2)} m of paired wall evidence; opening continuity is limited to ${opening.toFixed(2)} m.`,`Retained component bounds and pair membership are exposed read-only so non-target drawing regions can be audited without changing reconstructed geometry.`]};
}
