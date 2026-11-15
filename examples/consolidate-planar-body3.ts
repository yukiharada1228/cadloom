import {point3,createBoxBody3,booleanPlanarBodies3,consolidatePlanarBody3,serializeBody3,restoreBody3,locateBody3} from '../dist/index.js';
const outer=createBoxBody3(point3(0n,0n),4n,4n,4n),inner=createBoxBody3(point3(1n,1n,1n),2n,2n,2n);
const cut=booleanPlanarBodies3(outer,inner,'difference'),merged=consolidatePlanarBody3(cut),restored=restoreBody3(serializeBody3(merged.body));
console.log(JSON.stringify({
  before:{faces:cut.faces.length,edges:cut.topology.edges.length},
  after:{faces:restored.faces.length,edges:restored.topology.edges.length,shells:restored.record.shells.length},
  sourceFaceCounts:merged.sourceFaces.map(ids=>ids.length),retainedFaces:merged.retainedFaces,
  cavityCenter:locateBody3(restored,point3(2n,2n,2n)),
},null,2));
