import {point3,vector3,line3,cylinder3,intersectLineSurface3,classifyPointToSurface3,normalToSurface3} from '../dist/index.js';
import type {Surface3} from '../dist/index.js';
const surface:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n,0n),vector3(1n,1n,1n)),1n)};
const line=line3(point3(0n,0n,0n),vector3(1n,-1n,0n));
const result=intersectLineSurface3(line,surface);
if(result.kind==='points')console.log(result.hits.map(hit=>({
  multiplicity:hit.multiplicity,
  parameterPolynomial:hit.parameter.polynomial.coefficients.map(String),
  parameterInterval:[String(hit.parameter.lower),String(hit.parameter.upper)],
  onSurface:classifyPointToSurface3(hit.point,surface)===0,
  normalZ:normalToSurface3(hit.point,surface).z.sign(),
})));
else console.log(result.kind);
