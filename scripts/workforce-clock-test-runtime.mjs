let rendering;
export const Button="button", Input="input", Select="select", Clock="icon", Fragment="fragment";
export const jsx=(type,props)=>({type,props:props||{}});
export const jsxs=jsx;
export function useState(initial){
 const scope=rendering,index=scope.cursor++;
 if(!scope.slots[index])scope.slots[index]={kind:"state",value:typeof initial==="function"?initial():initial};
 const slot=scope.slots[index];
 return [slot.value,value=>{const next=typeof value==="function"?value(slot.value):value;if(!Object.is(next,slot.value)){slot.value=next;scope.dirty=true;}}];
}
export function useRef(initial){const scope=rendering,index=scope.cursor++;if(!scope.slots[index])scope.slots[index]={kind:"ref",value:{current:initial}};return scope.slots[index].value;}
export function useEffect(callback,deps){
 const scope=rendering,index=scope.cursor++,previous=scope.slots[index];
 if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i]))){
  const slot={kind:"effect",deps,cleanup:previous?.cleanup};scope.slots[index]=slot;scope.pending.push(()=>{slot.cleanup?.();slot.cleanup=callback();});
 }
}
export function createRenderer(Component,props){
 const scope={slots:[],cursor:0,pending:[],dirty:true,tree:null};
 const render=()=>{scope.cursor=0;scope.pending=[];scope.dirty=false;rendering=scope;scope.tree=Component(props);rendering=null;for(const effect of scope.pending)effect();return scope.tree;};
 const settle=async()=>{for(let i=0;i<20;i++){await Promise.resolve();if(scope.dirty)render();}return scope.tree;};
 const unmount=()=>{for(const slot of scope.slots)if(slot?.kind==="effect")slot.cleanup?.();};
 render();return {render,settle,unmount,get tree(){return scope.tree;}};
}
export const serverRows=new Map(),recordCalls=[];
let recordMode="success",releaseRecord;
const heldReads=new Map();
export function holdRecord(){recordMode="hold";return ()=>releaseRecord?.();}
export function failRecord(){recordMode="fail";}
export function holdRead(employeeId){
 let release;const promise=new Promise(resolve=>{release=resolve;});heldReads.set(employeeId,promise);
 return ()=>{heldReads.delete(employeeId);release();};
}
let readFailure=false;
export function setReadFailure(value){readFailure=value;}
export async function getWorkforceClockEntry(employeeId){
 const row=serverRows.get(employeeId);
 if(heldReads.has(employeeId))await heldReads.get(employeeId);
 if(readFailure)throw new Error("Synthetic status read failure");
 return row?{id:row.id,startedAt:row.started_at,endedAt:row.ended_at,breakMinutes:row.break_minutes,status:row.status}:null;
}
export async function recordWorkforceTimeEvent(input){
 recordCalls.push(input);
 if(recordMode==="hold"){await new Promise(resolve=>{releaseRecord=resolve;});recordMode="success";}
 if(recordMode==="fail")throw new Error("Synthetic save rejected");
 const previous=serverRows.get(input.employeeId);
 const row=input.action==="clock_in"?{id:"synthetic-entry",status:"open",started_at:new Date(Date.now()).toISOString(),ended_at:null,break_minutes:0}:
 {...previous,status:"submitted",ended_at:new Date(Date.now()).toISOString(),break_minutes:input.breakMinutes};
 serverRows.set(input.employeeId,row);return row;
}
