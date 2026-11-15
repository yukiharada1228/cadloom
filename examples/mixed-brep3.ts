import {point3,line3,cylinder3,intersectCylinders3,cylinderIntersectionBRepCurve3,reverseBRepCurve3,sewMixedBRepFaces3} from '../dist/index.js';
import type {BRepCurve3} from '../dist/index.js';
const origin=point3(0n,0n),a=cylinder3(line3(origin,point3(0n,0n,1n)),1n),b=cylinder3(line3(origin,point3(1n,0n,0n)),4n),graph=intersectCylinders3(a,b);
if(graph.kind!=='bounded')throw new Error('Expected bounded cylinder intersection');
const top=graph.arcs.filter(arc=>arc.branch===1).map(arc=>cylinderIntersectionBRepCurve3(arc)),bottom=graph.arcs.filter(arc=>arc.branch===-1).map(arc=>cylinderIntersectionBRepCurve3(arc)),reverse=(loop:readonly BRepCurve3[])=>[...loop].reverse().map(reverseBRepCurve3);
const {topology}=sewMixedBRepFaces3([
 {surface:{kind:'cylinder',cylinder:a},sense:1,loops:[bottom,reverse(top)]},
 {surface:{kind:'cylinder',cylinder:b},sense:1,loops:[top]},
 {surface:{kind:'cylinder',cylinder:b},sense:1,loops:[reverse(bottom)]},
],{requireClosed:true});
// Incidence diagnostic, not a persistent Body record or a face/material certificate.
console.log(JSON.stringify({faces:topology.faces.length,edges:topology.edges.length,vertices:topology.vertices.length,loops:topology.loops.length,closedOrientedIncidence:topology.closedOrientedIncidence,issues:topology.issues},null,2));
