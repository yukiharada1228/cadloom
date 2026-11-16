import {assertOwnedNurbsPlaneSplitFaceSurface3} from './nurbs-plane-split-faces3.js';
import type {NurbsPlaneSplitFaceSurface3} from './nurbs-plane-split-faces3.js';
import {locateNurbsPlaneSplitFaceParameters3} from './nurbs-plane-split-face-query3.js';
import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {gcdBivariate,divideBivariateExact} from '../numeric/bivariate-system.js';
import type {ExactInput} from './point2.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {assertOwnedNurbsSourceFaceComplex3} from './nurbs-source-face-complex3.js';
import type {NurbsSourceFaceComplex3} from './nurbs-source-face-complex3.js';
import {prepareNurbsSourceFacePolynomialPartition3} from './nurbs-source-face-partition3.js';
import {evaluateNurbsSourceComplexFace3} from './nurbs-source-complex-face-query3.js';
import type {NurbsSourceComplexFacePoint3} from './nurbs-source-complex-face-query3.js';
import {traceAlgebraicCurveProduct2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import type {AlgebraicCurveTopology2} from './algebraic-curve-topology2.js';

export interface NurbsSourcePlaneCell3 {
 readonly patch:number;readonly graph:AlgebraicCurveTopology2;readonly slab:number;
 readonly lowerEdge:number|null;readonly upperEdge:number|null;
 readonly sign:-1|0|1;
 readonly sample:Extract<NurbsSourceComplexFacePoint3,{kind:'point'}>;
}
/** Open two-dimensional strips only. Event fibers and curve boundaries are
 * retained in the arrangement graphs, not adopted as closed BRep faces. */
export type NurbsSourcePlaneCells3=
 | Readonly<{kind:'unresolved';reason:'unprepared-complex'|'face-location'}>
 | Readonly<{kind:'partitioned';complex:Extract<NurbsSourceFaceComplex3,{kind:'prepared'}>;face:number;plane:Plane3;planes:readonly Plane3[];restriction:NurbsPlaneSplitFaceSurface3|null;graphs:readonly AlgebraicCurveTopology2[];cells:readonly NurbsSourcePlaneCell3[]}>;
const owned=new WeakSet<NurbsSourcePlaneCells3>();
export function assertOwnedNurbsSourcePlaneCells3(report:NurbsSourcePlaneCells3):void {if(!owned.has(report))throw new RangeError('Expected factory-created plane cell partition');}
const real=(x:AlgebraicReal|ExactInput)=>x instanceof AlgebraicReal?x:AlgebraicReal.fromRational(x);
function between(a:AlgebraicReal,b:AlgebraicReal):AlgebraicReal {
 while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}
 return real(a.upper.add(b.lower).div(new Rational(2n)));
}
function own<T extends NurbsSourcePlaneCells3>(x:T):T {owned.add(x);return x;}
export function partitionNurbsSourceFaceByPlane3(complex:NurbsSourceFaceComplex3,face:number,input:Plane3):NurbsSourcePlaneCells3 {return partitionFace(complex,face,input,[],null);}
/** Repartition only an owned previous finite region. All ancestor plane zero
 * loci are included before selecting open cells, so a cell cannot cross the
 * old domain boundary. Disconnected regions of the same sign stay distinct. */
export function partitionNurbsSplitFaceByPlane3(surface:NurbsPlaneSplitFaceSurface3,input:Plane3):NurbsSourcePlaneCells3 {
 assertOwnedNurbsPlaneSplitFaceSurface3(surface);const old=surface.source.source.vertices.cells.source;
 return partitionFace(old.complex,old.face,input,old.planes,surface);
}
function partitionFace(complex:NurbsSourceFaceComplex3,face:number,input:Plane3,ancestors:readonly Plane3[],restriction:NurbsPlaneSplitFaceSurface3|null):NurbsSourcePlaneCells3 {
 assertOwnedNurbsSourceFaceComplex3(complex);
 if(complex.kind!=='prepared')return own(Object.freeze({kind:'unresolved',reason:'unprepared-complex'}));
 if(!Number.isSafeInteger(face)||!complex.faces.some(f=>f.face===face))throw new RangeError('Invalid prepared source face');
 const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),planes=Object.freeze([...ancestors,plane]),proof=complex.embedding.faces.find(f=>f.face===face);
 if(!proof||proof.kind!=='certified')throw new Error('Plane partition lost face embedding');
 const b=proof.method==='triangular'?proof.certificate.bounds:{uMin:proof.certificate.surface.startU,uMax:proof.certificate.surface.endU,vMin:proof.certificate.surface.startV,vMax:proof.certificate.surface.endV};
 const partition=prepareNurbsSourceFacePolynomialPartition3(complex.source),graphs:AlgebraicCurveTopology2[]=[],cells:NurbsSourcePlaneCell3[]=[];
 const min=(a:Rational,b:Rational)=>a.compare(b)<0?a:b,max=(a:Rational,b:Rational)=>a.compare(b)>0?a:b;
 for(const [patch,p] of complex.source.source.patches.entries()){
  const bounds={uMin:max(b.uMin,p.startU),uMax:min(b.uMax,p.endU),vMin:max(b.vMin,p.startV),vMax:min(b.vMax,p.endV)};
  if(bounds.uMin.compare(bounds.uMax)>=0||bounds.vMin.compare(bounds.vMax)>=0)continue;
  const F=p.x.scale(plane.normal.x).add(p.y.scale(plane.normal.y)).add(p.z.scale(plane.normal.z)).add(p.weight.scale(plane.offset));
  const polynomials=[...partition(bounds),...planes.map(q=>p.x.scale(q.normal.x).add(p.y.scale(q.normal.y)).add(p.z.scale(q.normal.z)).add(p.weight.scale(q.offset)))],seen:BivariatePolynomial[]=[],factors:BivariatePolynomial[]=[];let product=new BivariatePolynomial([[1n]]);
  // Scalar multiples have the same zero locus. Canonicalize before forming
  // the arrangement so repeated trim supports do not inflate its degree.
  for(const f of polynomials)if(f.degreeU>0||f.degreeV>0){
   // Rectangle sides already bound the strips. Their linear factors have no
   // zeros in the open rectangle, so adding them cannot refine an open cell.
   // Root/rectangle crossings remain projection events of the other factors.
   if(f.degreeU===1&&f.degreeV===0){const root=f.coefficient(0,0).neg().div(f.coefficient(1,0));if(root.compare(bounds.uMin)===0||root.compare(bounds.uMax)===0)continue;}
   if(f.degreeU===0&&f.degreeV===1){const root=f.coefficient(0,0).neg().div(f.coefficient(0,1));if(root.compare(bounds.vMin)===0||root.compare(bounds.vMax)===0)continue;}
   const row=f.rows[f.degreeU]!,canonical=f.scale(new Rational(1n).div(row.coefficient(row.degree)));
   if(!seen.some(q=>q.equals(canonical))){
    seen.push(canonical);
    const repeated=gcdBivariate(gcdBivariate(canonical,canonical.derivativeU()),canonical.derivativeV());
    const squareFree=divideBivariateExact(canonical,repeated),fresh=divideBivariateExact(squareFree,gcdBivariate(product,squareFree));
    product=product.mul(fresh);
    if(fresh.degreeU>0||fresh.degreeV>0)factors.push(fresh);
   }
  }
  const graph=traceAlgebraicCurveProduct2(factors,bounds);graphs.push(graph);
  for(const [slab,s] of graph.slabs.entries()){
   const u=real(s.sampleU),lo=real(bounds.vMin),hi=real(bounds.vMax);
   const cuts:{v:AlgebraicReal;edge:number|null}[]=[{v:lo,edge:null},...s.edges.map(edge=>({v:evaluateAlgebraicCurveEdge2(graph,edge,u).v,edge})).filter(q=>q.v.compare(lo)>0&&q.v.compare(hi)<0),{v:hi,edge:null}];
   cuts.sort((a,b)=>a.v.compare(b.v));
   for(let i=0;i+1<cuts.length;i++){
    const lower=cuts[i]!,upper=cuts[i+1]!,v=between(lower.v,upper.v),sample=evaluateNurbsSourceComplexFace3(complex,face,u,v);
    if(sample.kind==='unresolved')return own(Object.freeze({kind:'unresolved',reason:'face-location'}));
    if(sample.kind!=='point'||sample.stratum!=='face'||!sample.images.some(q=>q.patch===patch))continue;
    if(restriction!==null){const old=locateNurbsPlaneSplitFaceParameters3(restriction,u,v);if(old.kind==='unresolved')return own(Object.freeze({kind:'unresolved',reason:'face-location'}));if(old.location==='outside')continue;if(old.location!=='inside')throw new Error('Open refinement cell sample lies on prior region boundary');}
    cells.push(Object.freeze({patch,graph,slab,lowerEdge:lower.edge,upperEdge:upper.edge,sign:F.evaluateAlgebraic(u,v).sign(),sample}));
   }
  }
 }
 return own(Object.freeze({kind:'partitioned',complex,face,plane,planes,restriction,graphs:Object.freeze(graphs),cells:Object.freeze(cells)}));
}
/** Construct a point strictly inside a strip. u is native, fraction is the
 * relative position between its exact lower and upper curve branches. */
export function nurbsSourcePlaneCellPoint3(report:NurbsSourcePlaneCells3,cell:number,uInput:AlgebraicReal|ExactInput,fractionInput:ExactInput):Extract<NurbsSourceComplexFacePoint3,{kind:'point'}> {
 if(!owned.has(report))throw new RangeError('Expected factory-created plane cell partition');
 if(report.kind!=='partitioned')throw new RangeError('Plane cell partition is unresolved');
 if(!Number.isSafeInteger(cell)||cell<0||cell>=report.cells.length)throw new RangeError('Invalid plane cell');
 const c=report.cells[cell]!,g=c.graph,s=g.slabs[c.slab]!,u=real(uInput),fraction=real(fractionInput).recognizeRational().rational!;
 if(fraction.sign()<=0||fraction.compare(new Rational(1n))>=0)throw new RangeError('Cell fraction must be strictly between zero and one');
 if(u.compare(g.events[s.leftEvent]!.u)<=0||u.compare(g.events[s.rightEvent]!.u)>=0)throw new RangeError('u must lie strictly inside the cell slab');
 const a=c.lowerEdge===null?real(g.bounds.vMin):evaluateAlgebraicCurveEdge2(g,c.lowerEdge,u).v,b=c.upperEdge===null?real(g.bounds.vMax):evaluateAlgebraicCurveEdge2(g,c.upperEdge,u).v;
 const v=AlgebraicReal.linearCombination([{value:a,coefficient:new Rational(1n).sub(fraction)},{value:b,coefficient:fraction}]),q=evaluateNurbsSourceComplexFace3(report.complex,report.face,u,v);
 if(q.kind!=='point'||q.stratum!=='face'||!q.images.some(x=>x.patch===c.patch))throw new Error('Plane cell lost finite-face interior membership');
 const sign=AlgebraicReal.linearCombination([{value:q.point.x,coefficient:report.plane.normal.x},{value:q.point.y,coefficient:report.plane.normal.y},{value:q.point.z,coefficient:report.plane.normal.z}],report.plane.offset).sign();
 if(sign!==c.sign)throw new Error('Plane cell lost its constant halfspace sign');
 if(report.restriction!==null){const old=locateNurbsPlaneSplitFaceParameters3(report.restriction,u,v);if(old.kind!=='located'||old.location!=='inside')throw new Error('Open refinement cell left its prior finite region');}
 return q;
}
