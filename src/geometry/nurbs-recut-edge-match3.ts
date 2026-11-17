import {assertOwnedNurbsPlaneSplitFaceSurface3} from './nurbs-plane-split-faces3.js';
import type {NurbsPlaneSplitFaceSurface3} from './nurbs-plane-split-faces3.js';
import {assertOwnedSewnNurbsPlaneSplitEdge3,sewnNurbsPlaneSplitEdgePoint3} from './sew-nurbs-plane-split-faces3.js';
import type {SewnNurbsPlaneSplitEdge3} from './sew-nurbs-plane-split-faces3.js';
import {assertOwnedNurbsSourcePlaneCellComplex3,nurbsSourcePlaneCellComplexEdgePoint3} from './nurbs-source-plane-cell-complex3.js';
import type {NurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
import {gcdBivariate} from '../numeric/bivariate-system.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';
import type {ExactInput} from './point2.js';
export interface NurbsRecutEdgeMatchCertificate3 {
 readonly source:Extract<SewnNurbsPlaneSplitEdge3,{kind:'section'}>;readonly cells:NurbsSourcePlaneCellComplex3;readonly edge:number;
 readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;readonly direction:1;
 readonly method:'constant-coordinate'|'common-branch-continuation';
}
export type NurbsRecutEdgeMatch3=
 | Readonly<{kind:'matched';certificate:NurbsRecutEdgeMatchCertificate3}>
 | Readonly<{kind:'not-certified';reason:'source-curve'|'different-region'|'different-parameterization'|'not-contained'|'different-support'|'different-branch'}>;
const owned=new WeakSet<NurbsRecutEdgeMatchCertificate3>();
function between(a:AlgebraicReal,b:AlgebraicReal):AlgebraicReal {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return AlgebraicReal.fromRational(a.upper.add(b.lower).div(new Rational(2n)));}
/** Certify that a new finite cell edge is a whole subinterval of an old cut
 * curve, using the same owned original UV surface. Common polynomial factors,
 * exact branch selection and graph slabs without interior projection events
 * establish continuation through owned ancestor restrictions; coincident endpoints
 * alone never establish a match. An optional positive native subinterval must
 * lie in both curves, allowing a final parent edge to retain its exact limits. */
export function matchNurbsRecutSectionEdge3(source:SewnNurbsPlaneSplitEdge3,cells:NurbsSourcePlaneCellComplex3,edge:number,interval?:Readonly<{lower:AlgebraicReal;upper:AlgebraicReal}>):NurbsRecutEdgeMatch3 {
 assertOwnedSewnNurbsPlaneSplitEdge3(source);assertOwnedNurbsSourcePlaneCellComplex3(cells);if(!Number.isSafeInteger(edge)||edge<0||edge>=cells.edges.length)throw new RangeError('Invalid recut cell edge');const fail=(reason:Extract<NurbsRecutEdgeMatch3,{kind:'not-certified'}>['reason']):NurbsRecutEdgeMatch3=>Object.freeze({kind:'not-certified',reason});if(source.kind!=='section')return fail('source-curve');
 const E=source.source.topology.edges[source.edge]!,ancestors=new Set<NurbsPlaneSplitFaceSurface3>();let restriction=cells.source.restriction;while(restriction!==null&&!ancestors.has(restriction)){assertOwnedNurbsPlaneSplitFaceSurface3(restriction);ancestors.add(restriction);restriction=restriction.source.source.vertices.cells.source.restriction;}if(!E.coedges.some(id=>ancestors.has(source.source.topology.faces[source.source.topology.coedges[id]!.face]!.surface)))return fail('different-region');
 const local=E.curve,N=local.source,old=N.source.vertices.cells,oldEdge=old.edges[N.edges[local.edge]!.parent]!,newEdge=cells.edges[edge]!;
 if(old.source.complex!==cells.source.complex||old.source.face!==cells.source.face)return fail('different-region');
 const oldCell=old.source.cells[oldEdge.boundary]!,newCell=cells.source.cells[newEdge.boundary]!,a=old.boundaries[oldEdge.boundary]!.edges[oldEdge.edge]!.path,b=cells.boundaries[newEdge.boundary]!.edges[newEdge.edge]!.path;
 // Native t is v for vertical fibers and u otherwise. Nonconstant graph
 // branches cannot be reparameterized to a constant-u interval.
 if((a.kind==='u')!==(b.kind==='u'))return fail('different-parameterization');
 const lower=interval?.lower??newEdge.lower,upper=interval?.upper??newEdge.upper;if(lower.compare(upper)>=0||lower.compare(newEdge.lower)<0||upper.compare(newEdge.upper)>0||lower.compare(source.lower)<0||upper.compare(source.upper)>0)return fail('not-contained');
 let method:NurbsRecutEdgeMatchCertificate3['method']='constant-coordinate';
 if(a.kind==='u'&&b.kind==='u'){if(a.u.compare(b.u)!==0)return fail('different-support');}
 else if(a.kind==='v'&&b.kind==='v'){if(a.v.compare(b.v)!==0)return fail('different-support');}
 else {
  method='common-branch-continuation';
  if(a.kind==='curve'&&b.kind==='curve'){
   const H=gcdBivariate(oldCell.graph.polynomial,newCell.graph.polynomial);if(H.degreeU<=0&&H.degreeV<=0)return fail('different-support');
   const p=nurbsSourcePlaneCellComplexEdgePoint3(cells,edge,between(lower,upper));if(H.evaluateAlgebraic(p.u,p.v).sign()!==0)return fail('different-support');
  }else if(a.kind==='v'&&b.kind==='curve'){const v=a.v.recognizeRational().rational;if(v===null||newCell.graph.polynomial.specializeV(v).degree>=0)return fail('different-support');}
  else if(a.kind==='curve'&&b.kind==='v'){const v=b.v.recognizeRational().rational;if(v===null||oldCell.graph.polynomial.specializeV(v).degree>=0)return fail('different-support');}
  else return fail('different-parameterization');
 }
 for(const t of [lower,between(lower,upper),upper]){
  const p=nurbsSourcePlaneCellComplexEdgePoint3(old,N.edges[local.edge]!.parent,t),q=nurbsSourcePlaneCellComplexEdgePoint3(cells,edge,t);if(p.u.compare(q.u)!==0||p.v.compare(q.v)!==0)return fail('different-branch');if(compareAlgebraicPoints3(p.point,q.point)!==0)throw new Error('Common owned UV branch lost spatial equality');
 }
 const certificate=Object.freeze({source,cells,edge,lower,upper,direction:1 as const,method});owned.add(certificate);return Object.freeze({kind:'matched',certificate});
}
/** Native parameters agree on the certified whole interval. */
export function nurbsRecutEdgeMatchPoint3(certificate:NurbsRecutEdgeMatchCertificate3,input:AlgebraicReal|ExactInput){
 if(!owned.has(certificate))throw new RangeError('Expected factory-created recut edge match');const t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);if(t.compare(certificate.lower)<0||t.compare(certificate.upper)>0)throw new RangeError('Parameter outside recut edge match');const old=sewnNurbsPlaneSplitEdgePoint3(certificate.source,t),next=nurbsSourcePlaneCellComplexEdgePoint3(certificate.cells,certificate.edge,t);if(compareAlgebraicPoints3(old,next.point)!==0)throw new Error('Certified old/new cut curves lost equality');return Object.freeze({parameter:t,u:next.u,v:next.v,point:next.point});
}
