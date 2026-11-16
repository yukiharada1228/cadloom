import {assertOwnedSewnNurbsSourceEdgePlane3,nurbsSourcePlaneEdgeFragmentPointPreimages3} from './sewn-nurbs-source-edge-plane3.js';
import type {SewnNurbsSourceEdgePlane3} from './sewn-nurbs-source-edge-plane3.js';
import {assertOwnedNurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
import type {NurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {intersectPlanes3} from './plane3.js';
export interface NurbsPlaneCellSourceVertices3 {
 readonly source:SewnNurbsSourceEdgePlane3;readonly face:number;readonly cells:NurbsSourcePlaneCellComplex3;
 readonly vertices:readonly Readonly<{vertex:number;topologyVertex:number|null;edges:readonly Readonly<{edge:number;parameter:AlgebraicReal}>[]}>[];
}
/** Point correspondence only. Interior fragment preimages identify additional
 * cuts needed before sewing; they do not certify whole-edge equivalence. */
export function matchNurbsPlaneCellSourceVertices3(source:SewnNurbsSourceEdgePlane3,face:number,cells:NurbsSourcePlaneCellComplex3):NurbsPlaneCellSourceVertices3 {
 assertOwnedSewnNurbsSourceEdgePlane3(source);assertOwnedNurbsSourcePlaneCellComplex3(cells);
 if(!Number.isSafeInteger(face)||face<0||face>=source.topology.faces.length)throw new RangeError('Invalid refined source face');
 const f=source.topology.faces[face]!;
 if(cells.source.complex!==f.surface.source.complex||cells.source.face!==f.surface.face)throw new RangeError('Cell complex belongs to a different source face');
 if(intersectPlanes3(source.plane,cells.source.plane).kind!=='coincident')throw new RangeError('Cell complex uses a different cutting plane');
 const edgeIDs=[...new Set(f.loops.flatMap(loop=>source.topology.loops[loop]!.coedges.map(c=>source.topology.coedges[c]!.edge)))];
 const vertices=cells.vertices.map((v,vertex)=>{
  const edges=edgeIDs.flatMap(edge=>nurbsSourcePlaneEdgeFragmentPointPreimages3(source.topology.edges[edge]!.curve,v.point.point).map(parameter=>Object.freeze({edge,parameter})));
  if(v.point.stratum!=='face'&&!edges.length)throw new Error('Finite-face boundary vertex lost its original shared-edge preimage');
  const old=source.topology.vertices.findIndex(p=>compareAlgebraicPoints3(p,v.point.point)===0);
  return Object.freeze({vertex,topologyVertex:old<0?null:old,edges:Object.freeze(edges)});
 });
 return Object.freeze({source,face,cells,vertices:Object.freeze(vertices)});
}
