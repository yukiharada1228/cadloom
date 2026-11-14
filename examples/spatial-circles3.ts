import {point3,vector3,line3,cylinder3,circle3,fullCircleArc3,intersectLineCircle3,curveLoop3,curveOnSurface3} from '../dist/index.js';
import type {Curve3,Surface3} from '../dist/index.js';
const center=point3(0n,0n,0n),normal=vector3(1n,1n,1n);
const circle=circle3(center,normal,1n),arc=fullCircleArc3(circle);
const curve:Curve3={kind:'circular-arc',arc};
const cylinder:Surface3={kind:'cylinder',cylinder:cylinder3(line3(center,normal),1n)};
const loop=curveLoop3([curve],cylinder);
const hits=intersectLineCircle3(line3(center,vector3(1n,-1n,0n)),circle);
console.log({
  loopCurves:loop.curves.length,
  onCylinder:curveOnSurface3(curve,cylinder),
  seamYPolynomial:arc.start.y.polynomial.coefficients.map(String),
  lineHitCount:hits.length,
  hitParameters:hits.map(h=>({polynomial:h.parameter.polynomial.coefficients.map(String),interval:[String(h.parameter.lower),String(h.parameter.upper)]})),
});
