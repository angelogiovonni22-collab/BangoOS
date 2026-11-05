"use client";
import Link from "next/link";
import {useState} from "react";
import {Button} from "@/components/ui";
export function ReportCreationRecoveryNotice({pendingId,recoveredId,busy,onSeparate,es}:{pendingId:string|null;recoveredId:string|null;busy:boolean;onSeparate:()=>Promise<void>;es:boolean}){
  const [confirm,setConfirm]=useState(false);
  const l=(en:string,spanish:string)=>es?spanish:en;
  if(!pendingId)return null;
  return <section role="status" className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4">
    <p className="text-sm text-[var(--color-text-primary)]">{recoveredId?l("Previous report save recovered. Your current fields were not submitted again. Open the saved report to review it before continuing.","Se recuperó el reporte guardado. Los campos actuales no se enviaron otra vez. Abre el reporte guardado para revisarlo antes de continuar."):l("An unfinished save attempt is kept on this device. If the connection was interrupted, check the report before starting a separate one.","Hay un intento de guardado pendiente en este dispositivo. Si se interrumpió la conexión, revisa el reporte antes de iniciar otro.")}</p>
    <Link className="text-sm font-semibold underline" href={`/daily-reports/${recoveredId||pendingId}`}>{l("Check saved report","Revisar reporte guardado")}</Link>
    {!confirm?<Button variant="secondary" size="sm" disabled={busy} onClick={()=>setConfirm(true)}>{l("Start separate report","Iniciar otro reporte")}</Button>:<div role="group" aria-label={l("Separate report confirmation","Confirmar reporte separado")} className="space-y-2">
      <p className="text-sm text-[var(--color-text-secondary)]">{l("Discard these device fields and start a blank report? Any report already saved online and its history will be kept.","¿Descartar estos campos del dispositivo e iniciar un reporte vacío? Se conservarán el reporte guardado en línea y su historial.")}</p>
      <Button variant="secondary" size="sm" disabled={busy} onClick={()=>{void onSeparate().finally(()=>setConfirm(false));}}>{l("Discard device fields and start separate","Descartar campos e iniciar otro")}</Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={()=>setConfirm(false)}>{l("Keep current fields","Conservar campos actuales")}</Button>
    </div>}
  </section>;
}
