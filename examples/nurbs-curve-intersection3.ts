import {point3,nurbsCurve3,intersectNurbsCurves3,nurbsCurveRelationEdgePoint3} from '../dist/index.js';
const first=nurbsCurve3(1,[point3(0n,0n,0n),point3(1n,0n,0n)],[0n,0n,1n,1n]);
const second=nurbsCurve3(2,[point3(1n,0n,0n),point3(-1n,0n,0n),point3(1n,0n,0n)],[-1n,-1n,-1n,1n,1n,1n]);
const result=intersectNurbsCurves3(first,second);
console.log({events:result.points.length,relations:result.relations.length,branches:result.relations[0]!.topology.edges.map((_,edge)=>{const p=nurbsCurveRelationEdgePoint3(result,0,edge,'1/4');return {first:p.firstParameter.recognizeRational().rational!.toString(),second:p.secondParameter.recognizeRational().rational!.toString(),x:p.point.x.recognizeRational().rational!.toString()};})});
