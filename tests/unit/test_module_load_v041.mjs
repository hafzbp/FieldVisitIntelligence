import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const sourcePath = path.join(root, 'src/ui/app.js');
const smokePath = path.join(root, 'src/ui/.app_module_smoke_v041.js');

const source = await fs.readFile(sourcePath, 'utf8');
if (!/\nboot\(\);\s*$/.test(source)) throw new Error('Expected final boot() call not found');
const smoke = source.replace(/\nboot\(\);\s*$/, '\n// boot disabled only for module-load QA\n');
await fs.writeFile(smokePath, smoke);

Object.defineProperty(globalThis, 'navigator', {value:{onLine:true}, configurable:true});
Object.defineProperty(globalThis, 'window', {value:{addEventListener(){}}, configurable:true});
Object.defineProperty(globalThis, 'document', {value:{
  visibilityState:'visible',
  getElementById(){return {textContent:'',innerHTML:'',classList:{add(){},remove(){}}}},
  addEventListener(){},
  querySelectorAll(){return []}
}, configurable:true});
Object.defineProperty(globalThis, 'location', {value:{reload(){}}, configurable:true});

try {
  await import(pathToFileURL(smokePath).href + `?qa=${Date.now()}`);
  console.log('PASS QA-041-MODULE-LOAD: app.js parses, links local imports, and executes top-level initialization with browser stubs.');
} finally {
  await fs.rm(smokePath, {force:true});
}
