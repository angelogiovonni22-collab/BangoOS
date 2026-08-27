import { Suspense } from "react";
import { MeasureClient } from "./measure-client";

export default function MeasurePage(){
  return <Suspense fallback={<div className="p-6">Loading B.O.S. Measure…</div>}><MeasureClient/></Suspense>;
}
