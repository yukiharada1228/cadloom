import {assertOwnedCappedNurbsRecutHalf3} from './cap-nurbs-recut-half3.js';
import type {CappedNurbsRecutHalf3} from './cap-nurbs-recut-half3.js';
import {partitionNurbsSplitFaceByPlane3} from './nurbs-source-plane-cells3.js';
import {buildNurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
import {refineSewnNurbsSourceEdgesByPlane3} from './sewn-nurbs-source-edge-plane3.js';
import type {SewnNurbsSourceEdgePlane3} from './sewn-nurbs-source-edge-plane3.js';
import {matchNurbsPlaneCellSourceEdges3} from './nurbs-plane-cell-source-edges3.js';
import {nodeNurbsPlaneCellSourceEdges3} from './nurbs-plane-cell-source-nodes3.js';
import {buildNurbsPlaneSplitFaces3} from './nurbs-plane-split-faces3.js';
import type {NurbsPlaneSplitFaces3} from './nurbs-plane-split-faces3.js';
import {coverNurbsRecutParentSectionEdges3} from './nurbs-recut-parent-section-coverage3.js';
import type {NurbsRecutParentSectionCoverageCertificate3} from './nurbs-recut-parent-section-coverage3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
type Closed=Extract<CappedNurbsRecutHalf3,{kind:'closed'}>;type Built=Extract<NurbsPlaneSplitFaces3,{kind:'built'}>;
export interface NurbsRecutParentInterval3 {readonly edge:number;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;readonly direction:1|-1;}
export interface NurbsRecutSourceRepartitionInput3 {readonly face:number;readonly built:Built;readonly coverage:NurbsRecutParentSectionCoverageCertificate3;
 /** Local adopted edge -> full native parent intervals in local traversal order;
  * null is a newly introduced internal cutting edge. Physical trim parameters
  * may differ from local UV parameters; owned trim-map certificates bind them. */
 readonly parents:readonly (readonly NurbsRecutParentInterval3[]|null)[];
}
export type NurbsRecutSourceRepartition3=
 | Readonly<{kind:'unresolved';source:CappedNurbsRecutHalf3;plane:Plane3;reason:'parent-boundary'|'face-partition'|'source-faces'|'section-coverage'|'physical-coverage'|'orientation'|'source-edge';face?:number;edge?:number}>
 | Readonly<{kind:'partitioned';source:Closed;plane:Plane3;refinement:SewnNurbsSourceEdgePlane3;inputs:readonly NurbsRecutSourceRepartitionInput3[]}>;
const owned=new WeakSet<NurbsRecutSourceRepartition3>();
export function assertOwnedNurbsRecutSourceRepartition3(r:NurbsRecutSourceRepartition3):void {if(!owned.has(r))throw new RangeError('Expected factory-created retained source repartition');}
/** Repartition each actual retained finite face once. Original physical edges
 * use owned whole trim maps; inherited section edges use ancestor/native branch
 * coverage. Every external edge must be accounted, never a chordal fallback. */
export function repartitionNurbsRecutSourceFaces3(source:CappedNurbsRecutHalf3,input:Plane3):NurbsRecutSourceRepartition3 {
 assertOwnedCappedNurbsRecutHalf3(source);const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),own=<T extends NurbsRecutSourceRepartition3>(r:T):T=>{owned.add(r);return r;},fail=(reason:Extract<NurbsRecutSourceRepartition3,{kind:'unresolved'}>['reason'],face?:number,edge?:number):NurbsRecutSourceRepartition3=>own(Object.freeze({kind:'unresolved',source,plane,reason,...(face===undefined?{}:{face}),...(edge===undefined?{}:{edge})}));if(source.kind!=='closed')return fail('parent-boundary');
 const previous=source.source.boundary.source.source.source,R=refineSewnNurbsSourceEdgesByPlane3(previous.source.source,plane),T=source.topology,inputs:NurbsRecutSourceRepartitionInput3[]=[];
 for(const [face,F] of T.faces.entries()){const s=F.surface;if(s.kind!=='retained'||s.source.kind!=='source')continue;const q=partitionNurbsSplitFaceByPlane3(s.source.source,plane);if(q.kind!=='partitioned')return fail('face-partition',face);const cells=buildNurbsSourcePlaneCellComplex3(q),built=buildNurbsPlaneSplitFaces3(nodeNurbsPlaneCellSourceEdges3(matchNurbsPlaneCellSourceEdges3(R,s.source.source.sourceFace,cells)));if(built.kind!=='built')return fail('source-faces',face);const coverage=coverNurbsRecutParentSectionEdges3(source,face,cells);if(coverage.kind!=='covered')return fail('section-coverage',face,coverage.edge);if(built.topology.faces.some(f=>f.sense!==F.sense))return fail('orientation',face);
  const old=F.loops.flatMap(l=>T.loops[l]!.coedges.map(coedge=>{const h=T.coedges[coedge]!,c=T.edges[h.edge]!.curve,root=c.kind==='sewn-source'?c.source.topology.edges[c.edge]!.curve:null;if(root?.kind!=='source')return null;if(root.source.source!==R.source)throw new Error('Retained physical curve changed original source');return {coedge,edge:h.edge,direction:h.direction,raw:root.source.topology.edges[root.edge]!.curve.parent,lower:c.lower,upper:c.upper};})).filter(x=>x!==null),cover=new Map(old.map(h=>[h.coedge,[] as NurbsRecutParentInterval3[]])),parents:(readonly NurbsRecutParentInterval3[]|null)[]=[];
  for(const [edge,E] of built.topology.edges.entries()){const n=E.curve.source.edges[E.curve.edge]!,parts:NurbsRecutParentInterval3[]=[];
   if(n.source!==null){const p=n.source,raw=R.topology.edges[p.edge]!.curve.parent;if(E.coedges.length!==1)return fail('physical-coverage',face,edge);const direction=built.topology.coedges[E.coedges[0]!]!.direction*p.direction;
    for(const h of old)if(h.raw===raw&&h.direction===direction){const lower=p.lower.compare(h.lower)>0?p.lower:h.lower,upper=p.upper.compare(h.upper)<0?p.upper:h.upper;if(lower.compare(upper)<0){const part=Object.freeze({edge:h.edge,lower,upper,direction:p.direction});parts.push(part);cover.get(h.coedge)!.push(part);}}
    parts.sort((a,b)=>a.lower.compare(b.lower));let cursor=p.lower;for(const a of parts){if(a.lower.compare(cursor)!==0)return fail('physical-coverage',face,edge);cursor=a.upper;}if(cursor.compare(p.upper)!==0)return fail('physical-coverage',face,edge);if(p.direction===-1)parts.reverse();parents.push(Object.freeze(parts));
   }else{for(const p of coverage.certificate.matches[n.parent]!){const lower=n.lower.compare(p.lower)>0?n.lower:p.lower,upper=n.upper.compare(p.upper)<0?n.upper:p.upper;if(lower.compare(upper)<0)parts.push(Object.freeze({edge:p.edge,lower,upper,direction:1}));}
    parts.sort((a,b)=>a.lower.compare(b.lower));if(parts.length){let cursor=n.lower;for(const a of parts){if(a.lower.compare(cursor)!==0)return fail('source-edge',face,edge);cursor=a.upper;}if(cursor.compare(n.upper)!==0)return fail('source-edge',face,edge);parents.push(Object.freeze(parts));}else{if(cells.edges[n.parent]!.uses.length!==2)return fail('source-edge',face,edge);parents.push(null);}
   }
  }
  for(const h of old){const parts=cover.get(h.coedge)!.sort((a,b)=>a.lower.compare(b.lower));let cursor=h.lower;for(const p of parts){if(p.lower.compare(cursor)!==0)return fail('physical-coverage',face,h.edge);cursor=p.upper;}if(cursor.compare(h.upper)!==0)return fail('physical-coverage',face,h.edge);}
  inputs.push(Object.freeze({face,built,coverage:coverage.certificate,parents:Object.freeze(parents)}));
 }
 return own(Object.freeze({kind:'partitioned',source,plane,refinement:R,inputs:Object.freeze(inputs)}));
}
