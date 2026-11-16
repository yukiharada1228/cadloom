import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import type {NurbsSurfacePatch3} from './nurbs-surface3.js';
import type {PreparedNurbsParameterDomain2,NurbsDomainLocation2} from './nurbs-parameter-domain2.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
const real=(x:AlgebraicReal|ExactInput)=>x instanceof AlgebraicReal?x:AlgebraicReal.fromRational(x);
function inside(p:NurbsSurfacePatch3,u:AlgebraicReal,v:AlgebraicReal):boolean{return u.compare(real(p.startU))>=0&&u.compare(real(p.endU))<=0&&v.compare(real(p.startV))>=0&&v.compare(real(p.endV))<=0;}
/** Internal nonempty closed domain/patch-rectangle witness. */
export function nurbsDomainPatchWitness3(p:NurbsSurfacePatch3,d:PreparedNurbsParameterDomain2):Readonly<{u:AlgebraicReal;v:AlgebraicReal}>|null {
 const candidates:{u:AlgebraicReal;v:AlgebraicReal}[]=[{u:real(d.sample.u),v:real(d.sample.v)},...[p.startU,p.endU].flatMap(u=>[p.startV,p.endV].map(v=>({u:real(u),v:real(v)})))];
 for(const curve of [d.outer,...d.holes].flat())for(const span of nurbsCurveSpans3(curve)){
  const lo=real(span.startParameter),hi=real(span.endParameter),ts=[lo,hi];
  for(const [coordinate,limits] of [[span.x,[p.startU,p.endU]],[span.y,[p.startV,p.endV]]] as const)for(const limit of limits){const f=coordinate.sub(span.weight.scale(limit));if(f.degree>=0)ts.push(...isolateRealRoots(f).filter(t=>t.compare(lo)>=0&&t.compare(hi)<=0));}
  for(const t of ts){const q=evaluateNurbsSpanPoint3(span,t);candidates.push({u:q.x,v:q.y});}
 }
 return candidates.find(q=>inside(p,q.u,q.v)&&d.locate(q.u,q.v)!=='outside')??null;
}
/** Internal local CLOSED intersection classification; domain is validated. */
export function locateNurbsDomainPatch3(p:NurbsSurfacePatch3,domain:PreparedNurbsParameterDomain2,inputU:AlgebraicReal|ExactInput,inputV:AlgebraicReal|ExactInput):NurbsDomainLocation2 {
 const u=real(inputU),v=real(inputV);if(!inside(p,u,v))return 'outside';const location=domain.locate(u,v);if(location==='outside')return location;return u.compare(real(p.startU))===0||u.compare(real(p.endU))===0||v.compare(real(p.startV))===0||v.compare(real(p.endV))===0?'boundary':location;
}
