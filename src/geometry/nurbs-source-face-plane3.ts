import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {assertOwnedNurbsSourceFaceComplex3} from './nurbs-source-face-complex3.js';
import type {NurbsSourceFaceComplex3} from './nurbs-source-face-complex3.js';
import {evaluateNurbsSourceComplexFace3} from './nurbs-source-complex-face-query3.js';
import {prepareNurbsSourceFacePolynomialPartition3} from './nurbs-source-face-partition3.js';
import {traceAlgebraicCurve2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import type {AlgebraicCurveTopology2,CurveRectangle2} from './algebraic-curve-topology2.js';
import {prepareAlgebraicCurvePolynomialCuts2,witnessBivariatePartition2} from './algebraic-curve-inequalities2.js';
export interface NurbsSourcePlaneVertex3 {
 readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly point:AlgebraicCoordinates3;
 readonly stratum:'face'|'edge'|'vertex';readonly patches:readonly number[];
}
export interface NurbsSourcePlaneEdge3 {
 readonly patch:number;readonly graph:AlgebraicCurveTopology2;readonly edge:number;
 readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;readonly from:number;readonly to:number;
}
/** Coplanar finite-face domain clipped to a closed patch rectangle. Trims and
 * approached sides still apply: the rectangle alone is not the domain. */
export interface NurbsSourcePlaneArea3 {readonly patch:number;readonly bounds:CurveRectangle2;}
export type NurbsSourceFacePlane3=
 | Readonly<{kind:'unresolved';reason:'unprepared-complex'|'face-location'}>
 | Readonly<{kind:'resolved';complex:Extract<NurbsSourceFaceComplex3,{kind:'prepared'}>;face:number;plane:Plane3;vertices:readonly NurbsSourcePlaneVertex3[];edges:readonly NurbsSourcePlaneEdge3[];areas:readonly NurbsSourcePlaneArea3[]}>;
const owned=new WeakSet<NurbsSourceFacePlane3>(),real=(q:AlgebraicReal|ExactInput)=>q instanceof AlgebraicReal?q:AlgebraicReal.fromRational(q);
function own<T extends NurbsSourceFacePlane3>(r:T):T {owned.add(r);return r;}
function at(complex:NurbsSourceFaceComplex3,face:number,plane:Plane3,patch:number,u:AlgebraicReal,v:AlgebraicReal):NurbsSourcePlaneVertex3|'unresolved'|null {
 const q=evaluateNurbsSourceComplexFace3(complex,face,u,v);if(q.kind==='unresolved')return 'unresolved';if(q.kind!=='point'||!q.images.some(image=>image.patch===patch))return null;
 if(AlgebraicReal.linearCombination([{value:q.point.x,coefficient:plane.normal.x},{value:q.point.y,coefficient:plane.normal.y},{value:q.point.z,coefficient:plane.normal.z}],plane.offset).sign()!==0)throw new Error('Plane section lost full spatial plane equality');
 return Object.freeze({u,v,point:q.point,stratum:q.stratum,patches:Object.freeze(q.images.map(image=>image.patch))});
}
/** Exact finite-face section including isolated contacts and coplanar areas. */
export function intersectNurbsSourceFacePlane3(complex:NurbsSourceFaceComplex3,face:number,input:Plane3):NurbsSourceFacePlane3 {
 assertOwnedNurbsSourceFaceComplex3(complex);if(complex.kind!=='prepared')return own(Object.freeze({kind:'unresolved',reason:'unprepared-complex'}));
 if(!Number.isSafeInteger(face)||!complex.faces.some(f=>f.face===face))throw new RangeError('Invalid prepared source face');
 const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),P=complex.source,L=P.source,proof=complex.embedding.faces.find(f=>f.face===face);
 if(!proof||proof.kind!=='certified')throw new Error('Prepared plane query lost face certification');
 const b=proof.method==='triangular'?proof.certificate.bounds:{uMin:proof.certificate.surface.startU,uMax:proof.certificate.surface.endU,vMin:proof.certificate.surface.startV,vMax:proof.certificate.surface.endV},partition=prepareNurbsSourceFacePolynomialPartition3(P),vertices:NurbsSourcePlaneVertex3[]=[],edges:NurbsSourcePlaneEdge3[]=[],areas:NurbsSourcePlaneArea3[]=[];
 const min=(a:Rational,b:Rational)=>a.compare(b)<0?a:b,max=(a:Rational,b:Rational)=>a.compare(b)>0?a:b;let unresolved=false;
 const member=(patch:number,u:AlgebraicReal,v:AlgebraicReal)=>{const q=at(complex,face,plane,patch,u,v);if(q==='unresolved'){unresolved=true;return null;}return q;};
 const add=(patch:number,u:AlgebraicReal,v:AlgebraicReal):number|null=>{const q=member(patch,u,v);if(q===null)return null;const prior=vertices.findIndex(p=>p.u.compare(u)===0&&p.v.compare(v)===0);if(prior>=0){if(compareAlgebraicPoints3(vertices[prior]!.point,q.point)!==0)throw new Error('Plane section lost continuous patch equality');return prior;}vertices.push(q);return vertices.length-1;};
 for(const [patch,p] of L.patches.entries()){
  const bounds=Object.freeze({uMin:max(p.startU,b.uMin),uMax:min(p.endU,b.uMax),vMin:max(p.startV,b.vMin),vMax:min(p.endV,b.vMax)});if(bounds.uMin.compare(bounds.uMax)>=0||bounds.vMin.compare(bounds.vMax)>=0)continue;
  const F=p.x.scale(plane.normal.x).add(p.y.scale(plane.normal.y)).add(p.z.scale(plane.normal.z)).add(p.weight.scale(plane.offset));
  if(F.degreeU<0){const witness=witnessBivariatePartition2(partition(bounds),bounds,q=>{
   if(q.u.compare(real(bounds.uMin))<=0||q.u.compare(real(bounds.uMax))>=0||q.v.compare(real(bounds.vMin))<=0||q.v.compare(real(bounds.vMax))>=0)return false;
   return member(patch,q.u,q.v)?.stratum==='face';
  });if(witness)areas.push(Object.freeze({patch,bounds}));continue;}
  const graph=traceAlgebraicCurve2(F,bounds);graph.vertices.forEach(q=>add(patch,q.u,q.v));if(!graph.edges.length)continue;const cut=prepareAlgebraicCurvePolynomialCuts2(graph,partition(bounds));
  graph.edges.forEach((e,edge)=>{const axis=e.kind==='branch'?'u':'v',cuts=cut(edge,graph.vertices[e.from]![axis],graph.vertices[e.to]![axis]);for(const t of cuts){const q=evaluateAlgebraicCurveEdge2(graph,edge,t);add(patch,q.u,q.v);}
   for(let i=0;i+1<cuts.length;i++){const lower=cuts[i]!,upper=cuts[i+1]!;let a=lower,z=upper;while(a.upper.compare(z.lower)>=0){a=a.refine();z=z.refine();}
    const q=evaluateAlgebraicCurveEdge2(graph,edge,real(a.upper.add(z.lower).div(new Rational(2n))));if(member(patch,q.u,q.v)===null)continue;
    const x=evaluateAlgebraicCurveEdge2(graph,edge,lower),y=evaluateAlgebraicCurveEdge2(graph,edge,upper),from=add(patch,x.u,x.v),to=add(patch,y.u,y.v);if(from===null||to===null)throw new Error('Closed plane section lost an endpoint');edges.push(Object.freeze({patch,graph,edge,lower,upper,from,to}));
   }
  });
 }
 return unresolved?own(Object.freeze({kind:'unresolved',reason:'face-location'})):own(Object.freeze({kind:'resolved',complex,face,plane,vertices:Object.freeze(vertices),edges:Object.freeze(edges),areas:Object.freeze(areas)}));
}
function resolved(report:NurbsSourceFacePlane3):Extract<NurbsSourceFacePlane3,{kind:'resolved'}> {if(!owned.has(report))throw new RangeError('Expected factory-created finite-face plane section');if(report.kind!=='resolved')throw new RangeError('Plane section is unresolved');return report;}
export function nurbsSourceFacePlaneEdgePoint3(input:NurbsSourceFacePlane3,edge:number,parameter:AlgebraicReal|ExactInput):NurbsSourcePlaneVertex3 {
 const r=resolved(input);if(!Number.isSafeInteger(edge)||edge<0||edge>=r.edges.length)throw new RangeError('Invalid plane section edge');const e=r.edges[edge]!,t=real(parameter);if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the plane section edge');const uv=evaluateAlgebraicCurveEdge2(e.graph,e.edge,t),q=at(r.complex,r.face,r.plane,e.patch,uv.u,uv.v);if(q===null||q==='unresolved')throw new Error('Plane section edge lost certified finite-face membership');return q;
}
export function nurbsSourceFacePlaneAreaPoint3(input:NurbsSourceFacePlane3,area:number,uInput:AlgebraicReal|ExactInput,vInput:AlgebraicReal|ExactInput):NurbsSourcePlaneVertex3|null {
 const r=resolved(input);if(!Number.isSafeInteger(area)||area<0||area>=r.areas.length)throw new RangeError('Invalid plane section area');const a=r.areas[area]!,u=real(uInput),v=real(vInput),b=a.bounds;if(u.compare(real(b.uMin))<0||u.compare(real(b.uMax))>0||v.compare(real(b.vMin))<0||v.compare(real(b.vMax))>0)return null;const q=at(r.complex,r.face,r.plane,a.patch,u,v);if(q==='unresolved')throw new RangeError('Plane section area membership unresolved');return q;
}
