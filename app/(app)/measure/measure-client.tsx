"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Target = { id:string; name?:string; title?:string; project_number?:string|null; estimate_number?:string|null; status?:string };
type Point = { x:number; y:number };
type SavedMeasurement = { id:string; label:string; measurement_type:string; value_inches:number; method:string; confidence:string; created_at:string };

const REFERENCE_PRESETS = [
  { label:"12 in ruler", inches:12 },
  { label:"24 in level", inches:24 },
  { label:"36 in level", inches:36 },
  { label:"48 in level", inches:48 },
  { label:"8.5 in paper", inches:8.5 },
  { label:"11 in paper", inches:11 },
];

function distance(a:Point,b:Point){ return Math.hypot(b.x-a.x,b.y-a.y); }
function formatInches(value:number){ const feet=Math.floor(value/12); const inches=value-feet*12; return feet ? `${feet}' ${inches.toFixed(1)}\"` : `${inches.toFixed(1)}\"`; }

export function MeasureClient(){
  const search=useSearchParams();
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const imageRef=useRef<HTMLImageElement|null>(null);
  const [projects,setProjects]=useState<Target[]>([]); const [estimates,setEstimates]=useState<Target[]>([]);
  const [targetType,setTargetType]=useState(search.get("estimateId") ? "estimate" : "project");
  const [targetId,setTargetId]=useState(search.get("projectId") || search.get("estimateId") || "");
  const [photo,setPhoto]=useState<File|null>(null); const [points,setPoints]=useState<Point[]>([]);
  const [reference,setReference]=useState(12); const [verified,setVerified]=useState(0); const [calculationAccepted,setCalculationAccepted]=useState(false);
  const [label,setLabel]=useState(""); const [measurementType,setMeasurementType]=useState("length"); const [notes,setNotes]=useState("");
  const [saved,setSaved]=useState<SavedMeasurement[]>([]); const [message,setMessage]=useState(""); const [saving,setSaving]=useState(false);

  useEffect(()=>{ fetch("/api/measure").then(r=>r.json()).then(j=>{ if(j.ok){setProjects(j.projects||[]);setEstimates(j.estimates||[]);} }); },[]);
  useEffect(()=>{ if(!targetId)return; fetch(`/api/measure?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`).then(r=>r.json()).then(j=>{if(j.ok)setSaved(j.measurements||[])}); },[targetType,targetId]);

  const calculated=useMemo(()=>{ if(points.length<4||reference<=0)return 0; const refPx=distance(points[0],points[1]); return refPx ? reference*distance(points[2],points[3])/refPx : 0; },[points,reference]);
  const pointPrompt=points.length<2 ? `Tap reference point ${points.length+1} of 2` : points.length<4 ? `Tap measurement point ${points.length-1} of 2` : "Camera calculation ready";

  function redraw(){ const canvas=canvasRef.current,img=imageRef.current;if(!canvas||!img)return; const max=900,scale=Math.min(1,max/img.naturalWidth); canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale); const ctx=canvas.getContext("2d");if(!ctx)return;ctx.drawImage(img,0,0,canvas.width,canvas.height); points.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fillStyle=i<2?"#f59e0b":"#22c55e";ctx.fill();ctx.strokeStyle="#ffffff";ctx.lineWidth=2;ctx.stroke();}); if(points.length>=2){ctx.strokeStyle="#f59e0b";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);ctx.lineTo(points[1].x,points[1].y);ctx.stroke();} if(points.length>=4){ctx.strokeStyle="#22c55e";ctx.beginPath();ctx.moveTo(points[2].x,points[2].y);ctx.lineTo(points[3].x,points[3].y);ctx.stroke();} }
  useEffect(redraw,[points]);

  function choosePhoto(file:File|null){ setPhoto(file);setPoints([]);setVerified(0);setCalculationAccepted(false); if(!file)return; const img=new Image();img.onload=()=>{imageRef.current=img;redraw()};img.src=URL.createObjectURL(file); }
  function tapCanvas(e:React.MouseEvent<HTMLCanvasElement>){ if(points.length>=4)return; const c=e.currentTarget,r=c.getBoundingClientRect(); const next=[...points,{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}]; setPoints(next); setCalculationAccepted(false); if(next.length===4&&reference>0){const refPx=distance(next[0],next[1]);if(refPx>0)setVerified(Number((reference*distance(next[2],next[3])/refPx).toFixed(2)));} }
  function resetPoints(){setPoints([]);setVerified(0);setCalculationAccepted(false);}
  function acceptCalculation(){ if(calculated<=0)return; setVerified(Number(calculated.toFixed(2)));setCalculationAccepted(true);setMessage("Camera measurement accepted. Review the value, then save it to B.O.S."); }

  async function save(){ if(!targetId||!label.trim()||verified<=0){setMessage("Choose a project or estimate, add a label, and verify the measurement.");return;} setSaving(true);setMessage(""); const f=new FormData();f.set("targetType",targetType);f.set("targetId",targetId);f.set("label",label.trim());f.set("measurementType",measurementType);f.set("valueInches",String(verified));f.set("referenceInches",String(reference));f.set("notes",notes);if(photo)f.set("photo",photo); const res=await fetch("/api/measure",{method:"POST",body:f});const j=await res.json();setSaving(false);if(!j.ok){setMessage(j.error||"Could not save measurement.");return;}setMessage("Measurement saved to B.O.S.");setLabel("");setNotes("");resetPoints(); const refresh=await fetch(`/api/measure?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`).then(r=>r.json());if(refresh.ok)setSaved(refresh.measurements||[]); }

  const targets=targetType==="project"?projects:estimates;
  return <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
    <header><p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-500">B.O.S. Field Tool</p><h1 className="text-3xl font-bold">B.O.S. Measure</h1><p className="mt-2 text-sm text-muted-foreground">Camera-assisted measurement with automatic reference calculation. For best accuracy, keep the known reference and measured surface on the same plane.</p></header>
    <section className="grid gap-4 rounded-2xl border bg-card p-4 md:grid-cols-3"><label className="text-sm font-medium">Save to<select className="mt-2 w-full rounded-lg border bg-background p-2" value={targetType} onChange={e=>{setTargetType(e.target.value);setTargetId("")}}><option value="project">Project</option><option value="estimate">Estimate</option></select></label><label className="text-sm font-medium md:col-span-2">Destination<select className="mt-2 w-full rounded-lg border bg-background p-2" value={targetId} onChange={e=>setTargetId(e.target.value)}><option value="">Select {targetType}</option>{targets.map(t=><option key={t.id} value={t.id}>{t.project_number||t.estimate_number ? `${t.project_number||t.estimate_number} · `:""}{t.name||t.title}</option>)}</select></label></section>
    <section className="grid gap-6 lg:grid-cols-[1.4fr_.6fr]"><div className="space-y-4 rounded-2xl border bg-card p-4"><div><h2 className="font-semibold">1. Capture the work area</h2><p className="text-sm text-muted-foreground">Put a ruler, level, tape mark, or known-size object beside the surface you want to measure.</p></div><input aria-label="Take measurement photo" type="file" accept="image/*" capture="environment" onChange={e=>choosePhoto(e.target.files?.[0]||null)} className="block w-full text-sm"/>{photo&&<><div className="rounded-xl bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300">{pointPrompt}</div><canvas ref={canvasRef} onClick={tapCanvas} className="max-h-[65vh] w-full cursor-crosshair rounded-xl border object-contain"/><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-amber-500/15 px-3 py-1">1–2 reference</span><span className="rounded-full bg-green-500/15 px-3 py-1">3–4 measurement</span><button onClick={resetPoints} className="rounded-full border px-3 py-1">Reset points</button></div></>}</div><div className="space-y-4 rounded-2xl border bg-card p-4"><h2 className="font-semibold">2. Calibrate & calculate</h2><div><p className="text-sm font-medium">Quick reference</p><div className="mt-2 grid grid-cols-2 gap-2">{REFERENCE_PRESETS.map(p=><button key={p.label} type="button" onClick={()=>{setReference(p.inches);setCalculationAccepted(false)}} className={`rounded-lg border px-2 py-2 text-xs font-medium ${reference===p.inches?"border-blue-500 bg-blue-500/10":"bg-background"}`}>{p.label}</button>)}</div></div><label className="block text-sm">Known reference length (inches)<input type="number" min="0.01" step="0.01" value={reference} onChange={e=>{setReference(Number(e.target.value));setCalculationAccepted(false)}} className="mt-1 w-full rounded-lg border bg-background p-2"/></label><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Camera calculation</p><p className="text-2xl font-bold">{calculated?formatInches(calculated):"—"}</p>{calculated>0&&<button type="button" onClick={acceptCalculation} className="mt-3 w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white">Use camera measurement</button>}</div><label className="block text-sm font-semibold">Measurement to save (inches)<input type="number" min="0.01" step="0.01" value={verified||""} onChange={e=>{setVerified(Number(e.target.value));setCalculationAccepted(false)}} className="mt-1 w-full rounded-lg border bg-background p-2"/><span className="mt-1 block text-xs font-normal text-muted-foreground">{calculationAccepted?"Camera calculation selected. You can still correct it before saving.":"B.O.S. fills this automatically after four points; correct it with a tape/laser when accuracy matters."}</span></label></div></section>
    <section className="grid gap-4 rounded-2xl border bg-card p-4 md:grid-cols-2"><label className="text-sm">Label<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Living room north wall" className="mt-1 w-full rounded-lg border bg-background p-2"/></label><label className="text-sm">Type<select value={measurementType} onChange={e=>setMeasurementType(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="length">Length</option><option value="width">Width</option><option value="height">Height</option><option value="opening">Opening</option><option value="area">Area reference</option><option value="other">Other</option></select></label><label className="text-sm md:col-span-2">Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border bg-background p-2"/></label><div className="md:col-span-2"><button disabled={saving} onClick={save} className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving?"Saving…":"Save Measurement"}</button>{message&&<p className="mt-2 text-sm">{message}</p>}</div></section>
    {targetId&&<section className="rounded-2xl border bg-card p-4"><h2 className="font-semibold">Saved measurements</h2><div className="mt-3 divide-y">{saved.length===0?<p className="py-4 text-sm text-muted-foreground">No measurements saved yet.</p>:saved.map(m=><div key={m.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-medium">{m.label}</p><p className="text-xs text-muted-foreground">{m.measurement_type} · {m.confidence.replace("_"," ")}</p></div><strong>{formatInches(Number(m.value_inches))}</strong></div>)}</div></section>}
  </div>;
}
