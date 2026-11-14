import {point2,segment2,circle2,fullCircleArc2,booleanCurveRegions2,extrudeCurveRegionBRep3,point3} from '../dist/index.js';
import type {CurveRegion2} from '../dist/index.js';
const disk:CurveRegion2=[[{kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),1n))}]];
const p=[point2('1/2',-2n),point2(2n,-2n),point2(2n,2n),point2('1/2',2n)];
const clip:CurveRegion2=[p.map((start,i)=>({kind:'segment',segment:segment2(start,p[(i+1)%p.length]!)}))];
const profile=booleanCurveRegions2(disk,clip,'intersection');
const solid=extrudeCurveRegionBRep3(profile.rings,2n,{baseZ:'-1/2'});
console.log({
  vertices:solid.topology.vertices.length,edges:solid.topology.edges.length,
  faceKinds:solid.faces.map(f=>f.kind),shells:solid.topology.shells.length,
  closedOrientedIncidence:solid.topology.closedOrientedIncidence,
  inside:solid.locate(point3('3/4',0n,'1/2')),
  outside:solid.locate(point3(0n,0n,'1/2')),
  samples:solid.samples.map(p=>solid.locate(p)),
});
