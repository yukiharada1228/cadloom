import {point3,vector3,line3,cylinder3,plane3,circle3,circlePlane3,fullCircleArc3,buildBRepTopology3} from '../dist/index.js';
import type {Curve3,BRepFaceInput3} from '../dist/index.js';
const n=vector3(1n,1n,1n),bottom=circle3(point3(0n,0n,0n),n,1n),top=circle3(point3(2n,2n,2n),n,1n);
const edges:Curve3[]=[{kind:'circular-arc',arc:fullCircleArc3(bottom)},{kind:'circular-arc',arc:fullCircleArc3(top)}];
const faces:BRepFaceInput3[]=[
  {surface:{kind:'plane',plane:plane3(-1n,-1n,-1n)},sense:1,loops:[[{edge:0,direction:-1}]]},
  {surface:{kind:'plane',plane:circlePlane3(top)},sense:1,loops:[[{edge:1,direction:1}]]},
  {surface:{kind:'cylinder',cylinder:cylinder3(line3(bottom.center,n),1n)},sense:1,loops:[[{edge:0,direction:1}],[{edge:1,direction:-1}]]},
];
const topology=buildBRepTopology3(edges,faces);
console.log({
  vertices:topology.vertices.length,edges:topology.edges.length,coedges:topology.coedges.length,
  faces:topology.faces.length,shells:topology.shells.length,
  closedOrientedIncidence:topology.closedOrientedIncidence,
  linkPortDegrees:topology.vertexLinks.map(v=>v.degrees),issues:topology.issues,
});
// Incidence only: face domains, embedding and solid material still need certification.
