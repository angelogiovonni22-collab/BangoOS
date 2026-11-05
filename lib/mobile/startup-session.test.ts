import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { startupSessionBootstrap, claimStartupIntro } from "./startup-session";

let assertions = 0;
function check(actual: unknown, expected: unknown, label: string) { assert.deepEqual(actual, expected, label); assertions++; }
function storage() {
  const values = new Map<string,string>();
  return { getItem(key:string){return values.get(key) ?? null;},setItem(key:string,value:string){values.set(key,value);},values };
}
function documentLoad(tabStorage: unknown) {
  let prepaint = true;
  const root = { dataset: {} as { bosStartup?: string }, classList: { remove(name:string){assert.equal(name,"bos-startup-prepaint");prepaint=false;} } };
  runInNewContext(startupSessionBootstrap,{ document:{ documentElement:root }, sessionStorage:tabStorage });
  return {root,get prepaint(){return prepaint;}};
}
const tab = storage(), first = documentLoad(tab);
check(first.root.dataset.bosStartup,"show","first document in a tab may show the intro");
check(first.prepaint,true,"first launch keeps the startup background");
check(claimStartupIntro(first.root),true,"first component mount claims the intro");
check(claimStartupIntro(first.root),false,"remount in the same document cannot replay the intro");
const reload = documentLoad(tab);
check(reload.root.dataset.bosStartup,"skip","reload in the same tab skips the intro");
check(reload.prepaint,false,"skip releases the prepaint before the body renders");
check(claimStartupIntro(reload.root),false,"hydration cannot replay a skipped intro");
check(documentLoad(tab).root.dataset.bosStartup,"skip","full document navigation also skips");
check(documentLoad(storage()).root.dataset.bosStartup,"show","a new tab has its own first launch");
const interrupted = storage();
documentLoad(interrupted);
check(documentLoad(interrupted).root.dataset.bosStartup,"skip","interruption before playback completes does not replay on reload");
const denied = documentLoad({getItem(){throw new Error("Storage blocked");},setItem(){throw new Error("Storage blocked");}});
check(denied.root.dataset.bosStartup,"show","blocked storage does not strand the app behind startup checking");
check(claimStartupIntro(denied.root),true,"blocked storage still permits the initial intro");
check(claimStartupIntro(denied.root),false,"same-document protection still works with storage blocked");
const writeDenied = documentLoad({getItem(){return "1";},setItem(){throw new Error("Storage full");}});
check(writeDenied.root.dataset.bosStartup,"skip","an existing marker still skips if storage writes fail");
check(writeDenied.prepaint,false,"storage write failure does not retain prepaint on a repeat load");
check(Array.from(tab.values.values()),["1"],"only a non-sensitive seen flag is stored");
console.log("Startup session behavior: "+assertions+" assertions passed.");
