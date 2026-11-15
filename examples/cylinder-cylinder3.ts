import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {point3,line3,cylinder3,intersectCylinders3,encodeExactPoint3} from '../dist/index.js';
const first=cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),2n);
const second=cylinder3(line3(point3('1/3','2/5','1/7'),point3(1n,1n,1n)),1n);
const result=intersectCylinders3(first,second);
if(result.kind!=='bounded')throw new Error('Expected a bounded skew-cylinder intersection');
const directory=new URL('../artifacts/',import.meta.url);await mkdir(directory,{recursive:true});
const path=new URL('cylinder-cylinder-ssi3.json',directory);
await writeFile(path,JSON.stringify({
  purpose:'Exact diagnostic graph; not a persistent BRep/curve import schema',
  vertices:result.vertices.map(encodeExactPoint3),edges:result.edges,ports:result.ports,
  arcs:result.arcs.map(a=>({branch:a.branch,baseStart:encodeExactPoint3(a.base.start),baseEnd:encodeExactPoint3(a.base.end),start:encodeExactPoint3(a.start),end:encodeExactPoint3(a.end),sample:encodeExactPoint3(a.sample)})),
  isolatedPoints:result.isolatedPoints.map(encodeExactPoint3),singularVertices:result.singularVertices,components:result.components,
},null,2)+'\n');
console.log(JSON.stringify({kind:result.kind,arcs:result.arcs.length,vertices:result.vertices.length,components:result.components.length,singularVertices:result.singularVertices.length,isolatedPoints:result.isolatedPoints.length,saved:fileURLToPath(path)},null,2));
