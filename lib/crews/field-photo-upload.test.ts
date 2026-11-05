import assert from "node:assert/strict";
import { uploadFieldPhoto, isPhotoAlreadyStored, type PhotoMetadata, type PhotoUploadBackend } from "./field-photo-upload";
import type { FieldPhotoDraft } from "./field-photo-drafts";

async function main() {
  let checks = 0;
  const check = (value: unknown, label: string) => { assert.ok(value, label); checks++; };
  const base = (): FieldPhotoDraft => ({file:new Blob(["synthetic bytes"],{type:"image/png"}),fileName:"qa image.png",lastModified:1,note:" synthetic ",category:"inspection"});
  function fixture() {
    const objects = new Map<string,Blob>(), rows = new Map<string,PhotoMetadata>();
    let pending: FieldPhotoDraft = base(), writes = 0, uploads = 0, failPersist = false, loseStorageAck = false, loseMetadataAck = false, denied = false;
    const backend: PhotoUploadBackend = {
      async find(id) { if (denied) throw new Error("read denied"); return rows.get(id) ?? null; },
      async upload(path,file) { uploads++; if(objects.has(path)) return {message:"The resource already exists",statusCode:"409"}; objects.set(path,file); if(loseStorageAck) { loseStorageAck=false; throw new Error("storage response lost"); } return null; },
      async insert(row) { if(rows.has(row.id)) throw new Error("duplicate metadata"); rows.set(row.id,{...row}); writes++; if(loseMetadataAck) {loseMetadataAck=false;throw new Error("metadata response lost");} },
      async download(path) { if(denied) throw new Error("download denied"); const file=objects.get(path); if(!file) throw new Error("missing bytes"); return file; },
    };
    const run = () => uploadFieldPhoto({draft:pending,companyId:"company",userId:"actor",projectId:"project",backend,persist:async draft=>{ if(failPersist) throw new Error("quota"); pending=structuredClone(draft); }});
    return {objects,rows,backend,run,get pending(){return pending;},set pending(x){pending=x;},get writes(){return writes;},get uploads(){return uploads;},set failPersist(x:boolean){failPersist=x;},set loseStorageAck(x:boolean){loseStorageAck=x;},set loseMetadataAck(x:boolean){loseMetadataAck=x;},set denied(x:boolean){denied=x;}};
  }
  let f=fixture(); let result=await f.run(); check(!result.recovered&&f.writes===1,"normal upload creates once");
  const firstId=result.photo.id; result=await f.run(); check(result.recovered&&result.photo.id===firstId&&f.uploads===1&&f.writes===1,"retry returns matching saved row without write");
  f=fixture();f.failPersist=true;await assert.rejects(f.run(),/quota/);check(f.uploads===0&&f.writes===0,"device commit precedes network writes");
  f=fixture();f.loseStorageAck=true;await assert.rejects(f.run(),/storage response lost/);const stable=f.pending.uploadAttempt!.id;check(f.objects.size===1&&f.rows.size===0,"unknown storage response retains object and reference");result=await f.run();check(result.recovered&&result.photo.id===stable&&f.objects.size===1&&f.writes===1,"retry registers same orphan and verifies bytes");
  f=fixture();f.loseMetadataAck=true;result=await f.run();check(result.recovered&&f.writes===1&&f.objects.size===1,"lost metadata acknowledgement reconciles without deletion");
  f=fixture();await f.run(); const row=Array.from(f.rows.values())[0];row.uploaded_by="other";await assert.rejects(f.run(),/details differ/);check(f.uploads===1,"foreign actor never reused");row.uploaded_by="actor";row.project_id="other";await assert.rejects(f.run(),/details differ/);check(f.uploads===1,"foreign project never reused");row.project_id="project";row.company_id="other";await assert.rejects(f.run(),/details differ/);check(f.uploads===1,"foreign workspace never reused");row.company_id="company";
  row.note="changed online";await assert.rejects(f.run(),/details differ/);check(f.writes===1,"later metadata is not overwritten");row.note="synthetic";
  f.objects.set(row.storage_path,new Blob(["different bytes"]));await assert.rejects(f.run(),/could not be matched/);check(f.objects.size===1,"mismatched bytes are neither overwritten nor deleted");
  f=fixture();await f.run();f.pending={...f.pending,file:new Blob(["replacement"])};await assert.rejects(f.run(),/reference does not match/);check(f.uploads===1,"attempt cannot change file bytes");
  f=fixture();result=await f.run();f.pending={...f.pending,uploaded:result.photo};f.rows.clear();await assert.rejects(f.run(),/no longer available/);check(f.uploads===1,"confirmed deleted metadata is not recreated");
  f=fixture();result=await f.run();f.pending={...f.pending,uploaded:result.photo,uploadAttempt:undefined};result=await f.run();check(result.recovered&&f.uploads===1,"legacy uploaded marker verifies existing row and bytes");
  f=fixture();f.denied=true;await assert.rejects(f.run(),/read denied/);check(f.uploads===0,"denied reconciliation fails closed");
  f=fixture();f.backend.upload=async()=>({message:"invalid request",statusCode:400});await assert.rejects(f.run(),/invalid request/);check(f.writes===0,"generic errors cannot register metadata");
  f=fixture();f.loseStorageAck=true;await assert.rejects(f.run());const orphanPath=Array.from(f.objects.keys())[0];f.objects.set(orphanPath,new Blob(["collision"]));await assert.rejects(f.run(),/could not be matched/);check(f.objects.size===1&&f.writes===1,"orphan registration is not acknowledged when bytes differ");
  f=fixture();const insert=f.backend.insert;f.backend.insert=async()=>{throw new Error("metadata denied");};await assert.rejects(f.run(),/metadata denied/);check(f.objects.size===1&&f.rows.size===0,"metadata failure preserves object for retry");f.backend.insert=insert;result=await f.run();check(result.recovered&&f.writes===1,"later retry recovers retained object");
  f=fixture();f.loseStorageAck=true;await assert.rejects(f.run());const download=f.backend.download;f.backend.download=async()=>{throw new Error("download interrupted");};await assert.rejects(f.run(),/download interrupted/);check(f.rows.size===1,"failed confirmation keeps row without attaching");f.backend.download=download;result=await f.run();check(result.recovered&&f.writes===1,"confirmation retry does not insert another row");
  f=fixture();await f.run();const timestampRow=Array.from(f.rows.values())[0];timestampRow.captured_at=timestampRow.captured_at.replace("Z","+00:00");result=await f.run();check(result.recovered,"normalized database timestamp preserves identity");
  check(isPhotoAlreadyStored({message:"Asset Already Exists",statusCode:"400"}),"legacy exact duplicate supported");
  check(isPhotoAlreadyStored({message:"conflict",code:"ResourceAlreadyExists"}),"current duplicate code supported");
  check(!isPhotoAlreadyStored({message:"Access denied",statusCode:409}),"status alone is insufficient");
  f=fixture();f.loseStorageAck=true;await assert.rejects(f.run());const concurrent=await Promise.all([f.run(),f.run()]);check(concurrent.every(x=>x.photo.id===f.pending.uploadAttempt!.id)&&f.writes===1&&f.objects.size===1,"concurrent retries settle on one row and object");
  console.log(`Field photo upload recovery: ${checks} checks passed.`);
}
void main();
