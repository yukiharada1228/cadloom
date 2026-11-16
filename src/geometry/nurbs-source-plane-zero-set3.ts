import {assertOwnedNurbsSourcePlaneCellComplex3,nurbsSourcePlaneCellComplexEdgePoint3} from './nurbs-source-plane-cell-complex3.js';
import type {NurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
import {evaluateNurbsSourceComplexFace3} from './nurbs-source-complex-face-query3.js';
import {locateNurbsPlaneSplitFaceParameters3} from './nurbs-plane-split-face-query3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
type Point=NurbsSourcePlaneCellComplex3['vertices'][number]['point'];
export interface NurbsSourcePlaneZeroSetCertificate3 {
 readonly source:NurbsSourcePlaneCellComplex3;
 readonly vertices:readonly Readonly<{sourceVertex:number|null;point:Point;edges:readonly number[];isolated:boolean}>[];
 readonly edges:readonly Readonly<{edge:number;from:number;to:number;kind:'opposite-signs'|'same-sign'|'domain-boundary'|'coplanar-incidence';signs:readonly (-1|0|1)[];sampleParameter:Rational;sample:Point}>[];
 readonly isolated:readonly number[];
 readonly coplanarCells:readonly number[];
}
export type NurbsSourcePlaneZeroSet3=
 | Readonly<{kind:'analyzed';certificate:NurbsSourcePlaneZeroSetCertificate3}>
 | Readonly<{kind:'unresolved';source:NurbsSourcePlaneCellComplex3;reason:'face-location'}>;
const owned=new WeakSet<NurbsSourcePlaneZeroSetCertificate3>();
export function assertOwnedNurbsSourcePlaneZeroSet3(c:NurbsSourcePlaneZeroSetCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created finite plane zero set');}
/** Retain all zero strata before equal-sign seam cancellation. The owned
 * arrangement includes the plane polynomial, all projection events and finite
 * trim supports. Its open edges have constant nonzero sign or are whole zeros;
 * isolated graph vertices are checked independently of adopted face contours.
 * No absence of contact is inferred from ordinary region boundary loops. */
export function analyzeNurbsSourcePlaneZeroSet3(source:NurbsSourcePlaneCellComplex3):NurbsSourcePlaneZeroSet3 {
 assertOwnedNurbsSourcePlaneCellComplex3(source);const S=source.source,P=S.plane,sign=(p:Point)=>AlgebraicReal.linearCombination([{value:p.point.x,coefficient:P.normal.x},{value:p.point.y,coefficient:P.normal.y},{value:p.point.z,coefficient:P.normal.z}],P.offset).sign(),vertices:{sourceVertex:number|null;point:Point;edges:number[]}[]=[],map=new Map<number,number>();
 const add=(point:Point,sourceVertex:number|null)=>{const id=vertices.findIndex(v=>v.point.u.compare(point.u)===0&&v.point.v.compare(point.v)===0);if(id>=0){if(compareAlgebraicPoints3(vertices[id]!.point.point,point.point)!==0)throw new Error('Zero-set parameter vertex lost spatial continuity');return id;}vertices.push({sourceVertex,point,edges:[]});return vertices.length-1;};
 for(const [i,v] of source.vertices.entries())if(sign(v.point)===0)map.set(i,add(v.point,i));
 const edges:NurbsSourcePlaneZeroSetCertificate3['edges'][number][]=[];
 for(const [edge,e] of source.edges.entries()){
  let a=e.lower,b=e.upper;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}const sampleParameter=a.upper.add(b.lower).div(new Rational(2n)),sample=nurbsSourcePlaneCellComplexEdgePoint3(source,edge,sampleParameter);if(sign(sample)!==0)continue;
  const from=map.get(e.from),to=map.get(e.to);if(from===undefined||to===undefined)throw new Error('Whole plane-zero arc lost a closed endpoint');const signs=Object.freeze([...new Set(e.uses.map(u=>S.cells[u.cell]!.sign))].sort((a,b)=>a-b)),kind=signs.includes(0)?'coplanar-incidence':signs.includes(-1)&&signs.includes(1)?'opposite-signs':e.uses.length===1?'domain-boundary':'same-sign';vertices[from]!.edges.push(edge);vertices[to]!.edges.push(edge);edges.push(Object.freeze({edge,from,to,kind,signs,sampleParameter,sample}));
 }
 // An isolated zero need not survive as an adopted BRep vertex. Check every
 // projection-event root in the complete arrangement against the finite face
 // and the exact previous restriction, including algebraic critical points.
 for(const graph of S.graphs)for(const v of graph.vertices){const q=evaluateNurbsSourceComplexFace3(S.complex,S.face,v.u,v.v);if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',source,reason:'face-location'});if(q.kind!=='point'||sign(q)!==0)continue;if(S.restriction!==null){const r=locateNurbsPlaneSplitFaceParameters3(S.restriction,v.u,v.v);if(r.kind==='unresolved')return Object.freeze({kind:'unresolved',source,reason:'face-location'});if(r.location==='outside')continue;}add(q,null);}
 const records=Object.freeze(vertices.map(v=>Object.freeze({...v,edges:Object.freeze([...new Set(v.edges)]),isolated:v.edges.length===0}))),certificate=Object.freeze({source,vertices:records,edges:Object.freeze(edges),isolated:Object.freeze(records.flatMap((v,i)=>v.isolated?[i]:[])),coplanarCells:Object.freeze(S.cells.flatMap((c,i)=>c.sign===0?[i]:[]))});owned.add(certificate);return Object.freeze({kind:'analyzed',certificate});
}
