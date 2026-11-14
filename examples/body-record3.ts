import {mkdir,writeFile} from 'node:fs/promises';
import {point2,extrudeCurveRegionBRep3,bodyRecordFromTopology3,stringifyBodyRecord3,parseBodyRecord3,decodeBodyGeometry3} from '../dist/index.js';
const points=[point2(0n,0n),point2(2n,0n),point2(2n,3n),point2(0n,3n)],box=extrudeCurveRegionBRep3([points.map((start,i)=>({kind:'segment' as const,segment:{start,end:points[(i+1)%points.length]!}}))],4n);
const record=bodyRecordFromTopology3(box.topology,[{shells:[0],void:false},{shells:[0],void:false}]),json=stringifyBodyRecord3(record),geometry=decodeBodyGeometry3(parseBodyRecord3(json));
const directory=new URL('../artifacts/',import.meta.url);await mkdir(directory,{recursive:true});await writeFile(new URL('body-box.json',directory),json+'\n');
console.log({vertices:geometry.vertices.length,edges:geometry.record.edges.length,faces:geometry.record.faces.length,regions:geometry.record.regions.length,geometryDefinitionsRestored:true,solidCertificationRestored:false});
