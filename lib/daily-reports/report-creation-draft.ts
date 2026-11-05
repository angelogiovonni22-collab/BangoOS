import type { DailyReportUpsertInput } from "./types";

export type ReportCreationDraft = { creationId: string; draft: DailyReportUpsertInput };
export type ReportCreationDraftStorage = {
  read: (key: string) => Promise<ReportCreationDraft | null>;
  change: (key: string, update: (current: ReportCreationDraft | null) => ReportCreationDraft | null) => Promise<void>;
};
const DATABASE_NAME = "bango-report-creation-drafts", STORE_NAME = "drafts";

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE_NAME,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME);};
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror=()=>reject(request.error??new Error("Unable to open report recovery storage."));
    request.onblocked=()=>reject(new Error("Report recovery storage is blocked by another session."));
  });
}
const browserStorage:ReportCreationDraftStorage={
  async read(key){
    const db=await openDatabase();
    return new Promise<ReportCreationDraft|null>((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,"readonly"),request=tx.objectStore(STORE_NAME).get(key);
      let result:ReportCreationDraft|null=null;
      request.onsuccess=()=>{result=request.result??null;};
      tx.oncomplete=()=>{db.close();resolve(result);};
      tx.onerror=tx.onabort=()=>{db.close();reject(tx.error??new Error("Unable to load the pending report."));};
    });
  },
  async change(key,update){
    const db=await openDatabase();
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,"readwrite"),store=tx.objectStore(STORE_NAME),request=store.get(key);
      let failure:unknown;
      request.onsuccess=()=>{
        try{const next=update(request.result??null);if(next)store.put(next,key);else store.delete(key);}
        catch(error){failure=error;tx.abort();}
      };
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=tx.onabort=()=>{db.close();reject(failure??tx.error??new Error("Unable to save report recovery data."));};
    });
  },
};
export function createReportCreationDraftStore(resolveScope:()=>Promise<{companyId:string;userId:string}>,storage:ReportCreationDraftStorage=browserStorage){
  const keyFor=async()=>{const scope=await resolveScope();if(!scope.companyId||!scope.userId)throw new Error("Verified workspace access is required.");return JSON.stringify([scope.companyId,scope.userId]);};
  return{
    async load(){return storage.read(await keyFor());},
    async save(value:ReportCreationDraft){await storage.change(await keyFor(),current=>{
      if(current&&current.creationId!==value.creationId)throw new Error("Another unfinished report is saved on this device. Reopen New Report to review it before starting another.");
      return value;
    });},
    async remove(creationId:string){await storage.change(await keyFor(),current=>current?.creationId===creationId?null:current);},
  };
}
