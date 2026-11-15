import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {point3,line3,cylinder3,plane3,createCylinderBody3,splitCylinderBodyByPlane3,rejoinCylinderBodySplit3,serializeBody3,restoreBody3,locateBody3} from '../dist/index.js';
const parent=createCylinderBody3(cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),1n),-1n,1n);
const split=splitCylinderBodyByPlane3(parent,plane3(-1n,0n,1n));
const json=serializeBody3(split.negative),restored=restoreBody3(json);
const recut=splitCylinderBodyByPlane3(restored,plane3(0n,1n,0n));
const rejoined=rejoinCylinderBodySplit3(recut);
const directory=new URL('../artifacts/',import.meta.url);await mkdir(directory,{recursive:true});
const path=new URL('cylinder-body-negative.json',directory);await writeFile(path,json+'\n');
console.log(JSON.stringify({
  firstCut:split.kind,interfaceCurves:split.shared?[...new Set(split.shared.edges.map(e=>e.kind))]:[],
  negativeFaces:restored.faces.length,positiveFaces:split.positive.faces.length,
  recut:recut.kind,sample:locateBody3(recut.negative,point3('1/2','-1/4',0n)),
  rejoinedIsRestoredParent:rejoined.body===restored,
  saved:fileURLToPath(path),
},null,2));
