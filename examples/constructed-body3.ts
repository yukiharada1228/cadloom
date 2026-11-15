import {mkdir,writeFile} from 'node:fs/promises';
import {point2,point3,circle2,fullCircleArc2,extrudeBody3,serializeBody3,restoreBody3,locateBody3} from '../dist/index.js';
const p=[point2(-3n,-3n),point2(3n,-3n),point2(3n,3n),point2(-3n,3n)],outer=p.map((start,i)=>({kind:'segment' as const,segment:{start,end:p[(i+1)%p.length]!}})),hole={kind:'arc' as const,arc:fullCircleArc2(circle2(point2(0n,0n),1n),'cw')};
const body=extrudeBody3([outer,[hole]],2n,{fillRule:'nonzero'}),json=serializeBody3(body),restored=restoreBody3(json),directory=new URL('../artifacts/',import.meta.url);await mkdir(directory,{recursive:true});await writeFile(new URL('plate-body.json',directory),json+'\n');
console.log({faces:restored.record.faces.length,materialRegions:restored.record.regions.length-1,material:locateBody3(restored,point3(2n,0n,1n)),hole:locateBody3(restored,point3(0n,0n,1n)),holeWall:locateBody3(restored,point3(1n,0n,1n))});
