import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
const files=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(['node_modules','.git','.next'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(/\.(test|spec)\.[cm]?[jt]sx?$/.test(e.name))files.push(p);}}
await walk('.');files.sort();
const out='full-system-audit-results';await mkdir(out,{recursive:true});
const env={...process.env};for(const k of Object.keys(env))if(/TOKEN|SECRET|PASSWORD|DATABASE_URL|OPENAI|STRIPE/.test(k))delete env[k];
const results=[];let index=0;
async function worker(){while(index<files.length){const file=files[index++];const start=Date.now();let output='';let timeout=false;
const p=spawn('npx',['--yes','tsx','--require','./scripts/full-system-audit-no-network.cjs','--test',file],{env,stdio:['ignore','pipe','pipe']});p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);const timer=setTimeout(()=>{timeout=true;p.kill();},90000);const code=await new Promise(resolve=>{p.on('error',e=>{output+=String(e);resolve(-1)});p.on('close',resolve)});clearTimeout(timer);
const status=timeout?'blocked_timeout':code===0?'passed':'failed';const failure=output.split(/\r?\n/).find(l=>/AssertionError|FAIL:|Error:|error:/.test(l))?.slice(0,260)||output.slice(0,260);const row={file,status,code,elapsed_ms:Date.now()-start,failure:code===0?undefined:failure};results.push(row);await writeFile(path.join(out,String(results.length)+'.json'),JSON.stringify({...row,output},null,2));if(status!=='passed')console.log(JSON.stringify(row));if(results.length%50===0)console.log('Progress '+results.length+'/'+files.length);
}}
await Promise.all([worker(),worker()]);const counts={};for(const r of results)counts[r.status]=(counts[r.status]||0)+1;await writeFile(path.join(out,'summary.json'),JSON.stringify({total:files.length,counts,results},null,2));console.log('FULL_SYSTEM_SUMMARY '+JSON.stringify({total:files.length,counts}));console.log('FULL_SYSTEM_FAILURES '+JSON.stringify(results.filter(r=>r.status!=='passed')));if(results.some(r=>r.status!=='passed'))process.exitCode=1;
