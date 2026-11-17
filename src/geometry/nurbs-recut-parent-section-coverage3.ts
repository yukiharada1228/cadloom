import {assertOwnedCappedNurbsRecutHalf3} from './cap-nurbs-recut-half3.js';
import type {CappedNurbsRecutHalf3} from './cap-nurbs-recut-half3.js';
import {assertOwnedNurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
import type {NurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
import {matchNurbsRecutSectionEdge3,nurbsRecutEdgeMatchPoint3} from './nurbs-recut-edge-match3.js';
import type {NurbsRecutEdgeMatchCertificate3} from './nurbs-recut-edge-match3.js';
import {nurbsRecutJoinedCurvePoint3} from './nurbs-recut-face-join3.js';
import type {NurbsRecutJoinedCurve3} from './nurbs-recut-face-join3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
type Closed=Extract<CappedNurbsRecutHalf3,{kind:'closed'}>;
export interface NurbsRecutParentSectionMatchCertificate3 {readonly source:Closed;readonly face:number;readonly edge:number;readonly curve:NurbsRecutJoinedCurve3;readonly match:NurbsRecutEdgeMatchCertificate3;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;}
export type NurbsRecutParentSectionMatch3=
 | Readonly<{kind:'matched';certificate:NurbsRecutParentSectionMatchCertificate3}>
 | Readonly<{kind:'not-certified';reason:'parent-boundary'|'different-region'|'parent-edge'|'source-curve'|'empty-interval'|'native-match';query?:ReturnType<typeof matchNurbsRecutSectionEdge3>}>;
const matches=new WeakSet<NurbsRecutParentSectionMatchCertificate3>();
function sectionOf(c:NurbsRecutJoinedCurve3){const old=c.kind==='shared'?c.source.chains[c.chain]!.curve:c.kind==='sewn-source'?c.source.topology.edges[c.edge]!.curve:null;return old?.kind==='section'?old:null;}
/** Match the overlap of a current final parent section edge and a newly
 * partitioned source-face edge on their common owned UV branch. Both native
 * limits are retained; a new cell edge may cover several adjacent parent edges. */
export function matchNurbsRecutParentSectionEdge3(source:CappedNurbsRecutHalf3,face:number,edge:number,cells:NurbsSourcePlaneCellComplex3,cellEdge:number):NurbsRecutParentSectionMatch3 {
 assertOwnedCappedNurbsRecutHalf3(source);assertOwnedNurbsSourcePlaneCellComplex3(cells);const fail=(reason:Extract<NurbsRecutParentSectionMatch3,{kind:'not-certified'}>['reason'],query?:ReturnType<typeof matchNurbsRecutSectionEdge3>):NurbsRecutParentSectionMatch3=>Object.freeze({kind:'not-certified',reason,...(query===undefined?{}:{query})});if(source.kind!=='closed')return fail('parent-boundary');const T=source.topology;
 if(!Number.isSafeInteger(face)||face<0||face>=T.faces.length||!Number.isSafeInteger(edge)||edge<0||edge>=T.edges.length||!Number.isSafeInteger(cellEdge)||cellEdge<0||cellEdge>=cells.edges.length)throw new RangeError('Invalid parent/source section index');
 const f=T.faces[face]!,s=f.surface;if(s.kind!=='retained'||s.source.kind!=='source'||cells.source.restriction!==s.source.source)return fail('different-region');if(!T.edges[edge]!.coedges.some(id=>T.coedges[id]!.face===face))return fail('parent-edge');
 const curve=T.edges[edge]!.curve,old=sectionOf(curve);if(old===null)return fail('source-curve');const next=cells.edges[cellEdge]!,lower=curve.lower.compare(next.lower)>0?curve.lower:next.lower,upper=curve.upper.compare(next.upper)<0?curve.upper:next.upper;if(lower.compare(upper)>=0)return fail('empty-interval');const query=matchNurbsRecutSectionEdge3(old,cells,cellEdge,{lower,upper});if(query.kind!=='matched')return fail('native-match',query);
 const certificate=Object.freeze({source,face,edge,curve,match:query.certificate,lower,upper});matches.add(certificate);return Object.freeze({kind:'matched',certificate});
}
export function nurbsRecutParentSectionMatchPoint3(c:NurbsRecutParentSectionMatchCertificate3,input:AlgebraicReal|ExactInput){if(!matches.has(c))throw new RangeError('Expected factory-created parent section match');const t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);if(t.compare(c.lower)<0||t.compare(c.upper)>0)throw new RangeError('Parameter outside parent section match');const p=nurbsRecutEdgeMatchPoint3(c.match,t);if(compareAlgebraicPoints3(p.point,nurbsRecutJoinedCurvePoint3(c.curve,t))!==0)throw new Error('Owned parent native section lost XYZ equality');return p;}
export interface NurbsRecutParentSectionCoverageCertificate3 {
 readonly source:Closed;readonly face:number;readonly cells:NurbsSourcePlaneCellComplex3;
 readonly chains:readonly Readonly<{edge:number;curve:NurbsRecutJoinedCurve3;direction:1|-1;cuts:readonly AlgebraicReal[];fragments:readonly NurbsRecutParentSectionMatchCertificate3[]}>[];
 readonly matches:readonly (readonly NurbsRecutParentSectionMatchCertificate3[])[];
}
export type NurbsRecutParentSectionCoverage3=
 | Readonly<{kind:'covered';certificate:NurbsRecutParentSectionCoverageCertificate3}>
 | Readonly<{kind:'unresolved';source:CappedNurbsRecutHalf3;face:number;cells:NurbsSourcePlaneCellComplex3;reason:'parent-boundary'|'different-region'|'ambiguous-edge'|'orientation'|'gap'|'overlap';edge?:number;cellEdge?:number}>;
const coverages=new WeakSet<NurbsRecutParentSectionCoverageCertificate3>();
export function assertOwnedNurbsRecutParentSectionCoverage3(c:NurbsRecutParentSectionCoverageCertificate3):void {if(!coverages.has(c))throw new RangeError('Expected factory-created parent section coverage');}
/** Cover every section-generation parent edge incident to this exact retained
 * source face. Original physical source edges remain in their trim-map path. */
export function coverNurbsRecutParentSectionEdges3(source:CappedNurbsRecutHalf3,face:number,cells:NurbsSourcePlaneCellComplex3):NurbsRecutParentSectionCoverage3 {
 assertOwnedCappedNurbsRecutHalf3(source);assertOwnedNurbsSourcePlaneCellComplex3(cells);const fail=(reason:Extract<NurbsRecutParentSectionCoverage3,{kind:'unresolved'}>['reason'],edge?:number,cellEdge?:number):NurbsRecutParentSectionCoverage3=>Object.freeze({kind:'unresolved',source,face,cells,reason,...(edge===undefined?{}:{edge}),...(cellEdge===undefined?{}:{cellEdge})});if(source.kind!=='closed')return fail('parent-boundary');const T=source.topology;if(!Number.isSafeInteger(face)||face<0||face>=T.faces.length)throw new RangeError('Invalid parent source-face index');const F=T.faces[face]!,s=F.surface;if(s.kind!=='retained'||s.source.kind!=='source'||cells.source.restriction!==s.source.source)return fail('different-region');
 const uses=F.loops.flatMap(l=>T.loops[l]!.coedges.map(id=>T.coedges[id]!)).filter(h=>sectionOf(T.edges[h.edge]!.curve)!==null);if(new Set(uses.map(h=>h.edge)).size!==uses.length)return fail('ambiguous-edge');const byEdge=new Map(uses.map(h=>[h.edge,[] as NurbsRecutParentSectionMatchCertificate3[]])),byCell:NurbsRecutParentSectionMatchCertificate3[][]=cells.edges.map(()=>[]);
 for(const [cellEdge,e] of cells.edges.entries())if(e.uses.length===1){for(const h of uses){const q=matchNurbsRecutParentSectionEdge3(source,face,h.edge,cells,cellEdge);if(q.kind!=='matched')continue;if(h.direction!==e.uses[0]!.direction*F.sense)return fail('orientation',h.edge,cellEdge);byCell[cellEdge]!.push(q.certificate);byEdge.get(h.edge)!.push(q.certificate);}const pieces=byCell[cellEdge]!.sort((a,b)=>a.lower.compare(b.lower));for(let i=1;i<pieces.length;i++)if(pieces[i]!.lower.compare(pieces[i-1]!.upper)<0)return fail('ambiguous-edge',undefined,cellEdge);}
 const chains:NurbsRecutParentSectionCoverageCertificate3['chains'][number][]=[];
 for(const h of uses){const curve=T.edges[h.edge]!.curve,pieces=byEdge.get(h.edge)!.sort((a,b)=>a.lower.compare(b.lower));let cursor=curve.lower;const cuts=[cursor];for(const p of pieces){const order=p.lower.compare(cursor);if(order!==0)return fail(order>0?'gap':'overlap',h.edge,p.match.edge);nurbsRecutParentSectionMatchPoint3(p,p.lower);nurbsRecutParentSectionMatchPoint3(p,p.upper);cursor=p.upper;cuts.push(cursor);}if(cursor.compare(curve.upper)!==0)return fail('gap',h.edge);chains.push(Object.freeze({edge:h.edge,curve,direction:h.direction,cuts:Object.freeze(cuts),fragments:Object.freeze(pieces)}));}
 const certificate=Object.freeze({source,face,cells,chains:Object.freeze(chains),matches:Object.freeze(byCell.map(a=>Object.freeze(a)))});coverages.add(certificate);return Object.freeze({kind:'covered',certificate});
}
