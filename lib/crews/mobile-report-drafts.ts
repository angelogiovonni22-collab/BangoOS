import type { MobileDailyReportDraft } from "./mobile-field-operations-types";

const DATABASE_NAME="bango-field-report-drafts",STORE_NAME="drafts",DATABASE_VERSION=1;
type StoredDraft={key:string;draft:MobileDailyReportDraft;updatedAt:string};

function openDatabase():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(DATABASE_NAME,DATABASE_VERSION);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME,{keyPath:"key"});};request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};request.onerror=()=>reject(request.error??new Error("Unable to open mobile report draft storage."));request.onblocked=()=>reject(new Error("Mobile report draft storage is blocked by another session."));});}
function transaction<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{return openDatabase().then(database=>new Promise<T>((resolve,reject)=>{const tx=database.transaction(STORE_NAME,mode),request=operation(tx.objectStore(STORE_NAME));let result!:T;request.onsuccess=()=>{result=request.result;};request.onerror=()=>reject(request.error??new Error("Unable to access mobile report draft storage."));tx.oncomplete=()=>{database.close();resolve(result);};tx.onerror=()=>{database.close();reject(tx.error??new Error("Unable to commit mobile report draft storage."));};tx.onabort=()=>{database.close();reject(tx.error??new Error("Mobile report draft storage was cancelled."));};}));}

export function createMobileReportDraftStore(resolveScope:()=>Promise<{companyId:string;userId:string}>){const keyFor=async(crewId:string,reportDate:string)=>{const scope=await resolveScope();return `${scope.companyId}:${scope.userId}:${crewId}:${reportDate}`;};return{
  async load(crewId:string,reportDate:string){const key=await keyFor(crewId,reportDate),saved=await transaction<StoredDraft|undefined>("readonly",store=>store.get(key));return saved?.draft??null;},
  async save(crewId:string,reportDate:string,draft:MobileDailyReportDraft){const key=await keyFor(crewId,reportDate);await transaction("readwrite",store=>store.put({key,draft,updatedAt:new Date().toISOString()} satisfies StoredDraft));},
  async remove(crewId:string,reportDate:string){const key=await keyFor(crewId,reportDate);await transaction("readwrite",store=>store.delete(key));},
};}
