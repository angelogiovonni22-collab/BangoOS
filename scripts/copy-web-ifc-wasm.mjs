import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const targets=["web-ifc.wasm","web-ifc-mt.wasm"];
for(const name of targets){const destination=resolve("public/web-ifc",name);await mkdir(dirname(destination),{recursive:true});await copyFile(resolve("node_modules/web-ifc",name),destination);}
