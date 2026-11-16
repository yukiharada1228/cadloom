import {assertOwnedNurbsPlaneSplitFaceSurface3} from './nurbs-plane-split-faces3.js';
import type {NurbsPlaneSplitFaceSurface3} from './nurbs-plane-split-faces3.js';
import {evaluateNurbsSourceComplexFace3} from './nurbs-source-complex-face-query3.js';
import type {ExactInput} from './point2.js';
import {nurbsSourceComplexFacePointPreimage3} from './nurbs-source-complex-face-preimage3.js';
import {evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import {nurbsSourcePlaneCellComplexEdgePoint3} from './nurbs-source-plane-cell-complex3.js';
import {snapshotExactPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {Point3} from './point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
export type NurbsPlaneSplitFaceLocation3=
 | Readonly<{kind:'located';surface:NurbsPlaneSplitFaceSurface3;point:AlgebraicCoordinates3;location:'inside'|'outside'|'boundary'}>
 | Readonly<{kind:'unresolved';surface:NurbsPlaneSplitFaceSurface3;point:AlgebraicCoordinates3;reason:'face-preimage'}>;
/** Exact closed union of the original UV strip cells belonging to one split
 * region. Internal same-region seams are not finite-face boundaries. */
export function locateNurbsPlaneSplitFace3(surface:NurbsPlaneSplitFaceSurface3,input:Point3|AlgebraicCoordinates3):NurbsPlaneSplitFaceLocation3 {
 assertOwnedNurbsPlaneSplitFaceSurface3(surface);const point=snapshotExactPoint3(input),N=surface.source,cells=N.source.vertices.cells,S=cells.source,region=N.regions[surface.region]!;
 const located=(location:'inside'|'outside'|'boundary'):NurbsPlaneSplitFaceLocation3=>Object.freeze({kind:'located',surface,point,location});
 const q=nurbsSourceComplexFacePointPreimage3(S.complex,S.face,point);
 if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',surface,point,reason:'face-preimage'});
 if(q.kind!=='point')return located('outside');
 return classify(surface,point,q.u,q.v);
}
export type NurbsPlaneSplitFaceParameterLocation3=
 | Readonly<{kind:'located';surface:NurbsPlaneSplitFaceSurface3;u:AlgebraicReal;v:AlgebraicReal;location:'inside'|'boundary';point:AlgebraicCoordinates3}>
 | Readonly<{kind:'located';surface:NurbsPlaneSplitFaceSurface3;u:AlgebraicReal;v:AlgebraicReal;location:'outside';point?:AlgebraicCoordinates3}>
 | Readonly<{kind:'unresolved';surface:NurbsPlaneSplitFaceSurface3;u:AlgebraicReal;v:AlgebraicReal;reason:'face-parameters'}>;
/** Use known exact UV provenance without re-solving a spatial inverse. */
export function locateNurbsPlaneSplitFaceParameters3(surface:NurbsPlaneSplitFaceSurface3,inputU:AlgebraicReal|ExactInput,inputV:AlgebraicReal|ExactInput):NurbsPlaneSplitFaceParameterLocation3 {
 assertOwnedNurbsPlaneSplitFaceSurface3(surface);const real=(q:AlgebraicReal|ExactInput)=>q instanceof AlgebraicReal?q:AlgebraicReal.fromRational(q),u=real(inputU),v=real(inputV),S=surface.source.source.vertices.cells.source,q=evaluateNurbsSourceComplexFace3(S.complex,S.face,u,v);
 if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',surface,u,v,reason:'face-parameters'});
 if(q.kind!=='point')return Object.freeze({kind:'located',surface,u,v,location:'outside'});
 const result=classify(surface,q.point,u,v);if(result.kind!=='located')throw new Error('UV region classification unexpectedly unresolved');return Object.freeze({kind:'located',surface,u,v,point:q.point,location:result.location});
}
function classify(surface:NurbsPlaneSplitFaceSurface3,point:AlgebraicCoordinates3,u:AlgebraicReal,v:AlgebraicReal):NurbsPlaneSplitFaceLocation3 {
 const N=surface.source,cells=N.source.vertices.cells,S=cells.source,region=N.regions[surface.region]!,q={u,v},located=(location:'inside'|'outside'|'boundary'):NurbsPlaneSplitFaceLocation3=>Object.freeze({kind:'located',surface,point,location});
 let member=false;
 for(const id of region.cells){const c=S.cells[id]!,g=c.graph,slab=g.slabs[c.slab]!,left=g.events[slab.leftEvent]!.u,right=g.events[slab.rightEvent]!.u;
  if(q.u.compare(left)<0||q.u.compare(right)>0)continue;
  const lower=c.lowerEdge===null?AlgebraicReal.fromRational(g.bounds.vMin):evaluateAlgebraicCurveEdge2(g,c.lowerEdge,q.u).v,upper=c.upperEdge===null?AlgebraicReal.fromRational(g.bounds.vMax):evaluateAlgebraicCurveEdge2(g,c.upperEdge,q.u).v;
  if(q.v.compare(lower)>=0&&q.v.compare(upper)<=0){member=true;break;}
 }
 if(!member)return located('outside');
 for(const use of region.boundary){const edge=N.edges[use.edge]!,e=cells.edges[edge.parent]!,path=cells.boundaries[e.boundary]!.edges[e.edge]!.path;
  if(path.kind==='u'&&q.u.compare(path.u)!==0||path.kind==='v'&&q.v.compare(path.v)!==0)continue;
  const parameter=path.kind==='u'?q.v:q.u;if(parameter.compare(edge.lower)<0||parameter.compare(edge.upper)>0)continue;
  const a=nurbsSourcePlaneCellComplexEdgePoint3(cells,edge.parent,parameter);if(a.u.compare(q.u)===0&&a.v.compare(q.v)===0)return located('boundary');
 }
 return located('inside');
}
