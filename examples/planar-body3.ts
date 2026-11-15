import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createBoxBody3,booleanPlanarBodies3,serializeBody3,restoreBody3,locateBody3,point3} from '../dist/index.js';

const outer=createBoxBody3(point3(0n,0n),4n,4n,4n);
const inner=createBoxBody3(point3(1n,1n,1n),2n,2n,2n);
const cavity=booleanPlanarBodies3(outer,inner,'difference');
const serialized=serializeBody3(cavity),restored=restoreBody3(serialized);
const filled=booleanPlanarBodies3(restored,inner,'union');
const directory=new URL('../artifacts/',import.meta.url);
await mkdir(directory,{recursive:true});
const path=new URL('planar-body3.json',directory);
await writeFile(path,serialized+'\n');
console.log(JSON.stringify({
  cavity:{faces:restored.faces.length,regions:restored.record.regions,materialSamples:restored.interiorSamples.length,center:locateBody3(restored,point3(2n,2n,2n))},
  afterRefilling:{shells:filled.record.shells.length,center:locateBody3(filled,point3(2n,2n,2n))},
  saved:fileURLToPath(path),
},null,2));
