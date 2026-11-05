import assert from "node:assert/strict";
import { createBrowserFieldOfflineProviders, resolveBrowserFieldQueueScope, type FieldOfflineScope } from "./field-offline-queue";

let checks=0;
function check(value: unknown, message: string) { assert.ok(value,message); checks++; }
async function main() {
  // Minimal asynchronous IndexedDB transaction harness; no browser storage or network.
  const rows=new Map<string,Record<string,unknown>>();
  const originalDb=Object.getOwnPropertyDescriptor(globalThis,"indexedDB");
  const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,"navigator");
  const online={onLine:true};
  Object.defineProperty(globalThis,"navigator",{configurable:true,value:online});
  Object.defineProperty(globalThis,"indexedDB",{configurable:true,value:{
    open() {
      const request: Record<string,unknown>={};
      queueMicrotask(()=>{
        request.result={
          close(){},objectStoreNames:{contains:()=>true},
          transaction(){
            const tx: Record<string,unknown>={};
            tx.objectStore=()=> {
              const run=(operation:()=>unknown)=>{
                const req: Record<string,unknown>={};
                queueMicrotask(()=>{
                  req.result=operation();
                  (req.onsuccess as (()=>void)|undefined)?.();
                  (tx.oncomplete as (()=>void)|undefined)?.();
                });
                return req;
              };
              return {
                put:(item:Record<string,unknown>)=>run(()=>{rows.set(String(item.id),structuredClone(item));return item.id;}),
                get:(id:string)=>run(()=>rows.has(id)?structuredClone(rows.get(id)):undefined),
                getAll:()=>run(()=>structuredClone([...rows.values()])),
                delete:(id:string)=>run(()=>{rows.delete(id);}),
              };
            };
            return tx;
          },
        };
        (request.onsuccess as (()=>void)|undefined)?.();
      });
      return request;
    },
  }});
  try {
    let scope:FieldOfflineScope={companyId:"company-a",userId:"user-a"}, unavailable=false, calls=0;
    const offline=createBrowserFieldOfflineProviders(async()=>{
      calls++;
      if(unavailable) throw new Error("Synthetic access verification failure");
      return {...scope};
    });
    const first=await offline.queue.enqueue({type:"checklist",payload:{synthetic:true}});
    check((await offline.queue.list()).length===1,"initial account sees its own action");
    scope={companyId:"company-a",userId:"user-b"};
    check((await offline.queue.list()).length===0,"same-company account switch hides prior user's actions");
    await offline.queue.setStatus?.(first.id,"synced");
    check(rows.get(first.id)?.status==="queued","another account cannot acknowledge the old action");
    await offline.queue.remove?.(first.id);
    check(rows.has(first.id),"another account cannot remove the old action");
    const second=await offline.queue.enqueue({type:"checklist",payload:{synthetic:true}});
    check(rows.get(second.id)?.scopeKey==="company-a:user-b","new actions use current account");
    scope={companyId:"company-b",userId:"user-b"};
    check((await offline.queue.list()).length===0,"company switch hides prior workspace actions");
    await offline.queue.setStatus?.(second.id,"failed");
    check(rows.get(second.id)?.status==="queued","company switch cannot alter prior action status");
    scope={companyId:"company-a",userId:"user-a"};
    check((await offline.queue.list()).map(x=>x.id).join()===first.id,"original account's pending action is retained");
    check((await offline.sync.getStatus()).state==="pending","sync summary follows current scope");
    const beforeConcurrent=calls;
    await Promise.all([offline.queue.list(),offline.sync.getStatus()]);
    check(calls===beforeConcurrent+1,"concurrent queue reads share verification without caching it for future operations");
    unavailable=true;
    await assert.rejects(offline.queue.list(),/Synthetic access/); checks++;
    check(calls>=10,"scope is checked again instead of permanently caching the first result");

    let sessionUser:string|null="user-a", sessionError=false, tenantReads=0;
    const client={
      auth:{
        getSession:async()=>({data:{session:sessionUser?{user:{id:sessionUser}}:null},error:sessionError?new Error("Synthetic session error"):null}),
        getUser:async()=>({data:{user:{id:"user-b"}},error:null}),
      },
      from(table:string){
        tenantReads++;
        const result=()=>({error:null,data:table==="profiles"?{id:"user-b",company_id:"company-b",role:"employee"}:table==="company_memberships"?[{id:"member-b",company_id:"company-b",role:"employee",status:"active",is_primary:true}]:{id:"company-b",name:"Synthetic"}});
        const chain={select(){return chain;},eq(){return chain;},order(){return chain;},maybeSingle(){return Promise.resolve(result());},then(resolve:(v:ReturnType<typeof result>)=>unknown){return Promise.resolve(result()).then(resolve);}};
        return chain;
      },
    };
    const previous={companyId:"company-a",userId:"user-a"};
    online.onLine=false;
    check((await resolveBrowserFieldQueueScope(client as never,previous)).companyId==="company-a","offline same-account session can retain verified device partition");
    check(tenantReads===0,"offline local partition lookup does not query tenant tables");
    sessionUser="user-b";
    await assert.rejects(resolveBrowserFieldQueueScope(client as never,previous),/Sign in again/); checks++;
    sessionUser=null;
    await assert.rejects(resolveBrowserFieldQueueScope(client as never,previous),/Sign in again/); checks++;
    sessionUser="user-a";sessionError=true;
    await assert.rejects(resolveBrowserFieldQueueScope(client as never,previous),/Sign in again/); checks++;
    sessionError=false;online.onLine=true;
    const current=await resolveBrowserFieldQueueScope(client as never,previous);
    check(current.companyId==="company-b"&&current.userId==="user-b","online scope uses verified current workspace");
    check(tenantReads>0,"online cached identity cannot bypass workspace verification");
    console.log("Offline queue scope: "+checks+" assertions passed.");
  } finally {
    if(originalDb) Object.defineProperty(globalThis,"indexedDB",originalDb); else Reflect.deleteProperty(globalThis,"indexedDB");
    if(originalNavigator) Object.defineProperty(globalThis,"navigator",originalNavigator); else Reflect.deleteProperty(globalThis,"navigator");
  }
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
