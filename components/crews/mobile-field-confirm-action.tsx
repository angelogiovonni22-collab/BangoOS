"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function MobileFieldConfirmAction({label,confirmLabel,description,disabled,onConfirm}:{label:string;confirmLabel:string;description:string;disabled:boolean;onConfirm:()=>Promise<void>}){
  const[armed,setArmed]=useState(false);
  if(!armed)return <Button size="sm" variant="danger" disabled={disabled} onClick={()=>setArmed(true)}>{label}</Button>;
  return <div role="group" aria-label={`${label} confirmation`} className="w-full rounded-[var(--radius-card)] border border-[var(--color-danger-300)] bg-[var(--color-danger-50)] p-2"><p role="alert" className="text-xs text-[var(--color-danger-700)]">{description}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="danger" disabled={disabled} onClick={()=>void onConfirm().finally(()=>setArmed(false))}>{confirmLabel}</Button><Button size="sm" variant="outline" disabled={disabled} onClick={()=>setArmed(false)}>Cancel</Button></div></div>;
}
