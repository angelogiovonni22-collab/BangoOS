"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Crosshair, Flashlight, RotateCcw, Ruler, Save, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";

type Point = { x: number; y: number };
type Measurement = { id: string; a: Point; b: Point; value: number; unit: "in" | "cm"; label: string; createdAt: string };

type Props = { projectId: string; projectName: string };

export function ProjectMeasureWorkspace({ projectId, projectName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [firstPoint, setFirstPoint] = useState<Point | null>(null);
  const [secondPoint, setSecondPoint] = useState<Point | null>(null);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"in" | "cm">("in");
  const [label, setLabel] = useState("");
  const [history, setHistory] = useState<Measurement[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(`bos:measure:${projectId}`);
    if (raw) {
      try { setHistory(JSON.parse(raw) as Measurement[]); } catch { /* ignore invalid local cache */ }
    }
  }, [projectId]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setCameraError("Camera access is required. On iPhone, allow Camera access for B.O.S. in Safari settings, then try again.");
    }
  };

  const selectPoint = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cameraReady) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
    if (!firstPoint || secondPoint) { setFirstPoint(point); setSecondPoint(null); }
    else setSecondPoint(point);
  };

  const saveMeasurement = () => {
    const numericValue = Number(value);
    if (!firstPoint || !secondPoint || !Number.isFinite(numericValue) || numericValue <= 0) return;
    const next: Measurement = { id: crypto.randomUUID(), a: firstPoint, b: secondPoint, value: numericValue, unit, label: label.trim() || "Measurement", createdAt: new Date().toISOString() };
    const updated = [next, ...history].slice(0, 100);
    setHistory(updated);
    window.localStorage.setItem(`bos:measure:${projectId}`, JSON.stringify(updated));
    setFirstPoint(null); setSecondPoint(null); setValue(""); setLabel("");
  };

  const removeMeasurement = (id: string) => {
    const updated = history.filter((item) => item.id !== id);
    setHistory(updated);
    window.localStorage.setItem(`bos:measure:${projectId}`, JSON.stringify(updated));
  };

  const line = firstPoint && secondPoint ? { x: firstPoint.x, y: firstPoint.y, width: Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y), angle: Math.atan2(secondPoint.y - firstPoint.y, secondPoint.x - firstPoint.x) * 180 / Math.PI } : null;

  return <div className="space-y-5" data-orion-role="project measurement workspace">
    <Card variant="elevated" className="overflow-hidden rounded-[18px] border border-[var(--bos-border-light)]">
      <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-section-title font-bold text-[var(--bos-text-strong-on-light)]"><Ruler size={20}/> B.O.S. Measure</CardTitle><p className="mt-1 text-sm text-[var(--bos-text-medium-on-light)]">{projectName} · Camera measurement capture</p></div>
          <Button type="button" onClick={cameraReady ? stopCamera : startCamera}>{cameraReady ? "Stop Camera" : "Start Camera"}</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div onPointerDown={selectPoint} className="relative aspect-[3/4] max-h-[70vh] w-full touch-none overflow-hidden rounded-[18px] bg-slate-950 sm:aspect-video">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          {!cameraReady && <div className="absolute inset-0 grid place-items-center p-6 text-center text-white"><div><Camera className="mx-auto mb-3" size={38}/><p className="font-bold">Use your phone camera as a B.O.S. tape measure</p><p className="mt-2 text-sm text-slate-300">Start the camera, tap the first endpoint, then tap the second endpoint.</p></div></div>}
          {firstPoint && <span className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-blue-500 shadow" style={{left:`${firstPoint.x}%`,top:`${firstPoint.y}%`}}/>}
          {secondPoint && <span className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-blue-500 shadow" style={{left:`${secondPoint.x}%`,top:`${secondPoint.y}%`}}/>}
          {line && <span className="absolute h-1 origin-left bg-white shadow" style={{left:`${line.x}%`,top:`${line.y}%`,width:`${line.width}%`,transform:`rotate(${line.angle}deg)`}}/>}
          {cameraReady && <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white"><Crosshair className="mr-1 inline" size={13}/>{!firstPoint ? "Tap start point" : !secondPoint ? "Tap end point" : "Enter measured distance below"}</div>}
        </div>
        {cameraError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{cameraError}</p>}
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_120px_auto]">
          <Input aria-label="Measurement label" placeholder="Label (e.g. North wall)" value={label} onChange={(e)=>setLabel(e.target.value)} />
          <Input aria-label="Measured distance" inputMode="decimal" placeholder="Distance" value={value} onChange={(e)=>setValue(e.target.value)} />
          <select aria-label="Measurement unit" value={unit} onChange={(e)=>setUnit(e.target.value as "in"|"cm")} className="rounded-[10px] border border-[var(--bos-border-light)] bg-white px-3 text-sm font-semibold text-slate-800"><option value="in">inches</option><option value="cm">cm</option></select>
          <Button type="button" onClick={saveMeasurement} disabled={!firstPoint || !secondPoint || !value}><Save size={16}/> Save</Button>
        </div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={()=>{setFirstPoint(null);setSecondPoint(null)}}><RotateCcw size={15}/> Reset points</Button><span className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs text-[var(--bos-text-medium-on-light)]"><Flashlight size={14}/> Flashlight/depth calibration arrives with native ARKit/LiDAR</span></div>
        <p className="text-xs text-[var(--bos-text-medium-on-light)]">Phase 1 uses the camera for visual endpoints and records the verified field dimension you enter. Browser camera pixels alone are not presented as a physical measurement. Native ARKit/LiDAR will supply automatic depth-derived distance in the next phase.</p>
      </CardContent>
    </Card>

    <Card variant="elevated" className="rounded-[18px] border border-[var(--bos-border-light)]"><CardHeader><CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Measurement History</CardTitle></CardHeader><CardContent className="space-y-2 p-4 pt-0">
      {history.length === 0 ? <p className="text-sm text-[var(--bos-text-medium-on-light)]">No measurements saved on this device for this project yet.</p> : history.map(item=><div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--bos-border-light)] bg-white p-3"><div><p className="font-bold text-[var(--bos-text-strong-on-light)]">{item.label}</p><p className="text-sm text-[var(--bos-text-medium-on-light)]"><Check size={14} className="mr-1 inline"/>{item.value} {item.unit} · {new Date(item.createdAt).toLocaleString()}</p></div><Button type="button" variant="secondary" aria-label={`Delete ${item.label}`} onClick={()=>removeMeasurement(item.id)}><Trash2 size={15}/></Button></div>)}
    </CardContent></Card>
  </div>;
}
