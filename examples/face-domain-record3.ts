import {point3,createBoxBody3,restoreNativeBRepFaces3} from '../dist/index.js';
const body=createBoxBody3(point3(0n,0n,0n),2n,3n,4n),saved=JSON.stringify(body.record),restored=restoreNativeBRepFaces3(JSON.parse(saved));
console.log({faces:restored.faces.length,definitions:restored.faces.map(f=>f.record.kind),strictFaceSamples:restored.faces.every(f=>f.locate(f.sample)==='inside'),materialBodyRestored:false});
