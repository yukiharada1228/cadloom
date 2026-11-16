import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {solveBivariateEquations} from '../numeric/bivariate-system.js';
import {line3} from './surface3.js';
import type {Line3} from './surface3.js';
import {compareAlgebraicPoints3,algebraicCoordinates3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {ExactInput} from './point2.js';
import {assertOwnedNurbsSourceFaceComplex3} from './nurbs-source-face-complex3.js';
import type {NurbsSourceFaceComplex3} from './nurbs-source-face-complex3.js';
import {evaluateNurbsSourceComplexFace3} from './nurbs-source-complex-face-query3.js';
import {prepareNurbsSourceFacePolynomialPartition3} from './nurbs-source-face-partition3.js';
import {traceAlgebraicCurve2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import type {AlgebraicCurveTopology2} from './algebraic-curve-topology2.js';
import {prepareAlgebraicCurvePolynomialCuts2} from './algebraic-curve-inequalities2.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
export interface NurbsSourceLineVertex3 {
 readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly parameter:AlgebraicReal;readonly point:AlgebraicCoordinates3;
 readonly stratum:'face'|'edge'|'vertex';readonly normals:readonly Readonly<{patch:number;dotSign:1|0|-1}>[];
}
export interface NurbsSourceLineOverlap3 {
 readonly patch:number;readonly graph:AlgebraicCurveTopology2;readonly edge:number;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;
 readonly from:number;readonly to:number;
}
export type NurbsSourceFaceLine3=
 | Readonly<{kind:'unresolved';reason:'unprepared-complex'|'face-location'}>
 | Readonly<{kind:'discrete'|'overlap';complex:Extract<NurbsSourceFaceComplex3,{kind:'prepared'}>;face:number;line:Line3;forward:boolean;vertices:readonly NurbsSourceLineVertex3[];overlaps:readonly NurbsSourceLineOverlap3[]}>;
const owned=new WeakSet<NurbsSourceFaceLine3>(),one=new BivariatePolynomial([[1n]]),keys=['x','y','z'] as const,real=(q:Rational)=>AlgebraicReal.fromRational(q);
function own<T extends NurbsSourceFaceLine3>(r:T):T {owned.add(r);return r;}
export function intersectNurbsSourceFaceLine3(complex:NurbsSourceFaceComplex3,face:number,input:Line3):NurbsSourceFaceLine3 {return section(complex,face,input,false);}
export function intersectNurbsSourceFaceRay3(complex:NurbsSourceFaceComplex3,face:number,input:Line3):NurbsSourceFaceLine3 {return section(complex,face,input,true);}
function section(complex:NurbsSourceFaceComplex3,face:number,input:Line3,forward:boolean):NurbsSourceFaceLine3 {
 assertOwnedNurbsSourceFaceComplex3(complex);if(complex.kind!=='prepared')return own(Object.freeze({kind:'unresolved',reason:'unprepared-complex'}));
 if(!Number.isSafeInteger(face)||!complex.faces.some(f=>f.face===face))throw new RangeError('Invalid prepared source face');
 const line=line3(input.origin,input.direction),pivot=keys.find(k=>line.direction[k].sign()!==0)!,P=complex.source,L=P.source,proof=complex.embedding.faces.find(f=>f.face===face),rank=complex.embedding.rank;
 if(!proof||proof.kind!=='certified'||rank.kind!=='analyzed'||rank.interior.kind!=='analyzed')throw new Error('Prepared line query lost face certification');
 const support=rank.interior.support,partition=prepareNurbsSourceFacePolynomialPartition3(P),vertices:NurbsSourceLineVertex3[]=[],overlaps:NurbsSourceLineOverlap3[]=[];let unresolved=false;
 const b=proof.method==='triangular'?proof.certificate.bounds:{uMin:proof.certificate.surface.startU,uMax:proof.certificate.surface.endU,vMin:proof.certificate.surface.startV,vMax:proof.certificate.surface.endV};
 const min=(a:Rational,b:Rational)=>a.compare(b)<0?a:b,max=(a:Rational,b:Rational)=>a.compare(b)>0?a:b;
 for(const [patch,p] of L.patches.entries()){
  const bounds={uMin:max(p.startU,b.uMin),uMax:min(p.endU,b.uMax),vMin:max(p.startV,b.vMin),vMax:min(p.endV,b.vMax)};if(bounds.uMin.compare(bounds.uMax)>=0||bounds.vMin.compare(bounds.vMax)>=0)continue;
  const N=p[pivot].sub(p.weight.scale(line.origin[pivot])).scale(new Rational(1n).div(line.direction[pivot])),equations=keys.filter(k=>k!==pivot).map(k=>p[k].sub(p.weight.scale(line.origin[k])).sub(N.scale(line.direction[k]))),solutions=solveBivariateEquations(equations);
  const at=(u:AlgebraicReal,v:AlgebraicReal):NurbsSourceLineVertex3|null=>{
   if(u.compare(real(bounds.uMin))<0||u.compare(real(bounds.uMax))>0||v.compare(real(bounds.vMin))<0||v.compare(real(bounds.vMax))>0)return null;
   const parameter=N.rationalImage(u,v,p.weight);if(forward&&parameter.sign()<0)return null;const q=evaluateNurbsSourceComplexFace3(complex,face,u,v);if(q.kind==='unresolved'){unresolved=true;return null;}if(q.kind!=='point'||!q.images.some(image=>image.patch===patch))return null;if(compareAlgebraicPoints3(q.point,liftNurbsSectionPatch3(p,u,v))!==0)throw new Error('Approached line patch lost its face image');
   const actual=algebraicCoordinates3(...keys.map(k=>parameter.mul(real(line.direction[k])).add(real(line.origin[k]))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);if(compareAlgebraicPoints3(q.point,actual)!==0)throw new Error('Line solution lost full spatial equality');
   const normals=Object.freeze(q.images.map(image=>{const r=support.patches[image.patch]!;return Object.freeze({patch:image.patch,dotSign:r.normalX.scale(line.direction.x).add(r.normalY.scale(line.direction.y)).add(r.normalZ.scale(line.direction.z)).rationalImage(u,v,one).sign()});}));return Object.freeze({u,v,parameter,point:q.point,stratum:q.stratum,normals});
  };
  const add=(u:AlgebraicReal,v:AlgebraicReal):number|null=>{const q=at(u,v);if(q===null)return null;let id=vertices.findIndex(a=>a.u.compare(u)===0&&a.v.compare(v)===0);if(id<0){id=vertices.length;vertices.push(q);}return id;};
  solutions.points.forEach(q=>add(q.u,q.v));if(solutions.kind==='all')throw new Error('Certified rank-two patch maps wholly into a line');if(solutions.kind==='finite')continue;
  const graph=traceAlgebraicCurve2(solutions.commonFactor,bounds),cut=prepareAlgebraicCurvePolynomialCuts2(graph,[...partition(bounds),...(forward?[N]:[])]);graph.vertices.forEach(q=>add(q.u,q.v));
  graph.edges.forEach((e,edge)=>{const axis=e.kind==='branch'?'u':'v',cuts=cut(edge,graph.vertices[e.from]![axis],graph.vertices[e.to]![axis]);for(const t of cuts){const q=evaluateAlgebraicCurveEdge2(graph,edge,t);add(q.u,q.v);}
   for(let i=0;i+1<cuts.length;i++){const lower=cuts[i]!,upper=cuts[i+1]!;let a=lower,z=upper;while(a.upper.compare(z.lower)>=0){a=a.refine();z=z.refine();}const q=evaluateAlgebraicCurveEdge2(graph,edge,real(a.upper.add(z.lower).div(new Rational(2n))));
    // Membership is constant between every support, finite endpoint and ray
    // origin event. Keep the witness out of the returned event vertices.
    if(at(q.u,q.v)===null)continue;
    const start=evaluateAlgebraicCurveEdge2(graph,edge,lower),end=evaluateAlgebraicCurveEdge2(graph,edge,upper),from=add(start.u,start.v),to=add(end.u,end.v);if(from===null||to===null)throw new Error('Closed finite-face line overlap lost an endpoint');if(vertices[from]!.parameter.compare(vertices[to]!.parameter)===0)throw new Error('Embedded face has a collapsed line overlap');overlaps.push(Object.freeze({patch,graph,edge,lower,upper,from,to}));
   }
  });
 }
 if(unresolved)return own(Object.freeze({kind:'unresolved',reason:'face-location'}));
 const order=vertices.map((_,i)=>i).sort((a,b)=>vertices[a]!.parameter.compare(vertices[b]!.parameter)),indices:number[]=[];order.forEach((old,id)=>{indices[old]=id;});
 return own(Object.freeze({kind:overlaps.length?'overlap':'discrete',complex,face,line,forward,vertices:Object.freeze(order.map(id=>vertices[id]!)),overlaps:Object.freeze(overlaps.map(e=>Object.freeze({...e,from:indices[e.from]!,to:indices[e.to]!})))}));
}
export function nurbsSourceFaceLineOverlapPoint3(report:NurbsSourceFaceLine3,overlap:number,input:AlgebraicReal|ExactInput):NurbsSourceLineVertex3 {
 if(!owned.has(report))throw new RangeError('Expected factory-created NURBS face line report');if(report.kind==='unresolved'||!Number.isSafeInteger(overlap)||overlap<0||overlap>=report.overlaps.length)throw new RangeError('Invalid NURBS line overlap');const e=report.overlaps[overlap]!,t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the NURBS line overlap');
 const q=evaluateAlgebraicCurveEdge2(e.graph,e.edge,t),v=evaluateNurbsSourceComplexFace3(report.complex,report.face,q.u,q.v);if(v.kind!=='point'||!v.images.some(image=>image.patch===e.patch))throw new Error('Line overlap lost approached face membership');const pivot=keys.find(k=>report.line.direction[k].sign()!==0)!,parameter=v.point[pivot].sub(real(report.line.origin[pivot])).div(real(report.line.direction[pivot]));if(report.forward&&parameter.sign()<0)throw new Error('Line overlap lost forward-ray membership');const actual=algebraicCoordinates3(...keys.map(k=>parameter.mul(real(report.line.direction[k])).add(real(report.line.origin[k]))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);if(compareAlgebraicPoints3(actual,v.point)!==0)throw new Error('Line overlap lost full spatial equality');
 const rank=report.complex.embedding.rank;if(rank.kind!=='analyzed'||rank.interior.kind!=='analyzed')throw new Error('Line overlap lost face rank');const support=rank.interior.support,normals=Object.freeze(v.images.map(image=>{const r=support.patches[image.patch]!;return Object.freeze({patch:image.patch,dotSign:r.normalX.scale(report.line.direction.x).add(r.normalY.scale(report.line.direction.y)).add(r.normalZ.scale(report.line.direction.z)).rationalImage(q.u,q.v,one).sign()});}));return Object.freeze({u:q.u,v:q.v,parameter,point:v.point,stratum:v.stratum,normals});
}
