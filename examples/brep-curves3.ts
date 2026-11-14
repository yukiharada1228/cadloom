import {point2,point3,vector3,line3,cylinder3,plane3,circle2,fullCircleArc2,planeFrame3,planarArc3,curveLoop3,curveOnSurface3,pointOnCurve3} from '../dist/index.js';
import type {Curve3,Surface3} from '../dist/index.js';
// A tilted section: local circle maps to the 3D ellipse (x,y,y).
const frame=planeFrame3(point3(0n,0n,0n),vector3(1n,0n,0n),vector3(0n,1n,1n));
const edge:Curve3={kind:'planar-arc',arc:planarArc3(frame,fullCircleArc2(circle2(point2(0n,0n),1n)))};
const cylinder:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n)};
const plane:Surface3={kind:'plane',plane:plane3(0n,-1n,1n)};
const loop=curveLoop3([edge],cylinder);
console.log({
  curves:loop.curves.length,
  onCylinder:curveOnSurface3(edge,cylinder),
  onSectionPlane:curveOnSurface3(edge,plane),
  topOnEdge:pointOnCurve3(point3(0n,1n,1n),edge),
  originOnEdge:pointOnCurve3(point3(0n,0n,0n),edge),
});
