import type { DailyChecklist } from "./mobile-field-operations-types";
import { checklistMatchesDay, validChecklistDate } from "./mobile-checklist-day";

const DATABASE_NAME="bango-field-checklist-drafts",STORE_NAME="drafts",DATABASE_VERSION=1;
export type StoredChecklistDraft={key:string;checklist:DailyChecklist;updatedAt:string};
type ChecklistDraftStorage={get:(key:string)=>Promise<StoredChecklistDraft|undefined>;put:(draft:StoredChecklistDraft)=>Promise<unknown>;remove:(key:string)=>Promise<unknown>};
function openDatabase():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(DATABASE_NAME,DATABASE_VERSION);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME,{keyPath:"key"});};request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};request.onerror=()=>reject(request.error??new Error("Unable to open checklist draft storage."));request.onblocked=()=>reject(new Error("Checklist draft storage is blocked by another session."));});}
function transaction<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{return openDatabase().then(database=>new Promise<T>((resolve,reject)=>{const tx=database.transaction(STORE_NAME,mode),request=operation(tx.objectStore(STORE_NAME));let result!:T;request.onsuccess=()=>{result=request.result;};request.onerror=()=>reject(request.error??new Error("Unable to access checklist draft storage."));tx.oncomplete=()=>{database.close();resolve(result);};tx.onerror=()=>{database.close();reject(tx.error??new Error("Unable to commit checklist draft storage."));};tx.onabort=()=>{database.close();reject(tx.error??new Error("Checklist draft storage was cancelled."));};}));}
const browserStorage:ChecklistDraftStorage={get:key=>transaction("readonly",store=>store.get(key)),put:draft=>transaction("readwrite",store=>store.put(draft)),remove:key=>transaction("readwrite",store=>store.delete(key))};

export function createMobileChecklistDraftStore(resolveScope:()=>Promise<{companyId:string;userId:string}>,storage:ChecklistDraftStorage=browserStorage){
  const keysFor=async(crewId:string,workDate:string)=>{
    if(!crewId||!validChecklistDate(workDate))throw new Error("A crew and checklist date are required.");
    const scope=await resolveScope();
    const legacy=`${scope.companyId}:${scope.userId}:${crewId}`;
    return {key:`${legacy}:${workDate}`,legacy};
  };
  return {
    async load(crewId:string,workDate:string,timeZone:string){
      const {key,legacy}=await keysFor(crewId,workDate),saved=await storage.get(key);
      if(saved)return checklistMatchesDay(saved.checklist,workDate,timeZone)?saved.checklist:null;
      const previous=await storage.get(legacy);
      if(!previous||!checklistMatchesDay({...previous.checklist,updatedAt:previous.updatedAt},workDate,timeZone))return null;
      return {...previous.checklist,workDate};
    },
    async save(crewId:string,workDate:string,checklist:DailyChecklist){const {key}=await keysFor(crewId,workDate);await storage.put({key,checklist:{...checklist,workDate},updatedAt:new Date().toISOString()});},
    async remove(crewId:string,workDate:string){const {key}=await keysFor(crewId,workDate);await storage.remove(key);},
  };
}
