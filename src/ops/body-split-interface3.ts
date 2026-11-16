import {assertOwnedBodyPlaneSplit3} from './body-plane-split3.js';
import type {BodyPlaneSplit3} from './body-plane-split3.js';
import {locateBody3,locateBodyFace3} from '../model/body3.js';
import type {KernelBody3} from '../model/body3.js';
import {dot3} from '../geometry/point3.js';
import type {Point3} from '../geometry/point3.js';
import {classifyPointToSurface3,surfacesCoincide3} from '../geometry/surface3.js';
import type {Plane3} from '../geometry/plane3.js';
import {snapshotExactPoint3} from '../geometry/algebraic-point3.js';
import type {AlgebraicCoordinates3} from '../geometry/algebraic-point3.js';
import {nativeBRepCurve3,reverseBRepCurve3} from '../geometry/brep-curve3.js';
import type {BRepCurve3} from '../geometry/brep-curve3.js';
import {sewMixedBRepFaces3} from '../geometry/sew-mixed-brep3.js';
import type {MixedBRepFace3} from '../geometry/sew-mixed-brep3.js';
import type {BRepEdgeUse3} from '../geometry/brep-topology3.js';
import type {CurveRegionLocation2} from '../geometry/curve-boolean2.js';

export interface BodySplitInterfaceCoedge3 {
 readonly face:number;readonly loop:number;readonly coedge:number;readonly edge:number;
 /** Common curve atoms, in the actual child coedge's traversal order. */
 readonly uses:readonly BRepEdgeUse3[];
}
export interface BodySplitInterfaceAtom3 {
 readonly curve:BRepCurve3;
 readonly negative:readonly Readonly<{coedge:number;direction:1|-1}>[];
 readonly positive:readonly Readonly<{coedge:number;direction:1|-1}>[];
 /** False for a subdivision seam which cancels within each side separately. */
 readonly boundary:boolean;
}
export interface BodySplitInterface3 {
 readonly plane:Plane3;readonly negativeFaces:readonly number[];readonly positiveFaces:readonly number[];
 readonly negativeCoedges:readonly BodySplitInterfaceCoedge3[];readonly positiveCoedges:readonly BodySplitInterfaceCoedge3[];
 readonly atoms:readonly BodySplitInterfaceAtom3[];
 /** Relative location in the union of new finite cut faces, including holes. */
 locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
const cache=new WeakMap<BodyPlaneSplit3,BodySplitInterface3>();
/** Internal extraction; callers supply an owned split child and actual face ID. */
export function bodySplitFacePatch3(body:KernelBody3,face:number):MixedBRepFace3 {
 const t=body.topology,f=t.faces[face]!;
 return {surface:f.surface,sense:f.sense,loops:f.loops.map(loop=>t.loops[loop]!.coedges.map(id=>{const h=t.coedges[id]!,c=t.edges[h.edge]!.curve,mixed=c.kind==='native'||c.kind==='cylinder-ssi'?c:nativeBRepCurve3(c);return h.direction===1?mixed:reverseBRepCurve3(mixed);} ))};
}
/** Lazy finite interface correspondence. Selected cap boundaries are split at all
 * supplied endpoints and coincident finite pieces are shared, so different child subdivisions need not have matching face IDs.
 * Does not infer parent-face lineage or certify an arbitrary imported BRep. */
export function bodySplitInterface3(split:BodyPlaneSplit3):BodySplitInterface3 {
 assertOwnedBodyPlaneSplit3(split);const known=cache.get(split);if(known)return known;
 const select=(body:KernelBody3,side:-1|1):readonly number[]=>{
  if(split.representation==='planar')return Object.freeze(split.planar.shared.map(p=>side===-1?p.negativeFace:p.positiveFace));
  // Generated surface-material faces are cells refined by every source support.
  // Source membership is constant on a cut cell's relative interior; samples
  // select cells, while full finite boundaries below establish correspondence.
  return Object.freeze(body.topology.faces.flatMap((f,id)=>f.surface.kind==='plane'&&surfacesCoincide3(f.surface,{kind:'plane',plane:split.plane})&&locateBody3(split.parent,body.faces[id]!.sample)==='inside'?[id]:[]));
 };
 const negativeFaces=select(split.negative,-1),positiveFaces=select(split.positive,1),rows=[...negativeFaces.map(face=>({side:-1 as const,body:split.negative,face})),...positiveFaces.map(face=>({side:1 as const,body:split.positive,face}))];
 for(const row of rows){const f=row.body.topology.faces[row.face]!;if(f.surface.kind!=='plane'||dot3(f.surface.plane.normal,split.plane.normal).sign()*f.sense!==-row.side)throw new Error('Cut interface face has an incorrect physical normal');}
 const sewn=sewMixedBRepFaces3(rows.map(row=>bodySplitFacePatch3(row.body,row.face))),negativeCoedges:BodySplitInterfaceCoedge3[]=[],positiveCoedges:BodySplitInterfaceCoedge3[]=[];
 rows.forEach((row,index)=>{const t=row.body.topology;for(const [loopIndex,loop] of t.faces[row.face]!.loops.entries())for(const [i,coedge] of t.loops[loop]!.coedges.entries()){
  const h=t.coedges[coedge]!,entry=Object.freeze({face:row.face,loop,coedge,edge:h.edge,uses:sewn.sourceUses[index]![loopIndex]![i]!});(row.side===-1?negativeCoedges:positiveCoedges).push(entry);
 }});
 const atoms=Object.freeze(sewn.topology.edges.map((e,id):BodySplitInterfaceAtom3=>{
  const uses=(entries:readonly BodySplitInterfaceCoedge3[])=>Object.freeze(entries.flatMap(row=>row.uses.filter(use=>use.edge===id).map(use=>Object.freeze({coedge:row.coedge,direction:use.direction}))));
  const negative=uses(negativeCoedges),positive=uses(positiveCoedges),n=negative.reduce((s,u)=>s+u.direction,0),p=positive.reduce((s,u)=>s+u.direction,0);
  if(Math.abs(n)>1||Math.abs(p)>1||n+p!==0)throw new Error('Finite cut interfaces have different oriented boundaries');
  return Object.freeze({curve:e.curve,negative,positive,boundary:n!==0});
 }));
 const result:BodySplitInterface3=Object.freeze({plane:split.plane,negativeFaces,positiveFaces,negativeCoedges:Object.freeze(negativeCoedges),positiveCoedges:Object.freeze(positiveCoedges),atoms,locate:(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2=>{
  const p=snapshotExactPoint3(point);
  if(classifyPointToSurface3(p,{kind:'plane',plane:split.plane})!==0||!negativeFaces.some(id=>locateBodyFace3(split.negative,id,p)!=='outside'))return 'outside';
  return locateBody3(split.parent,p)==='inside'?'inside':'boundary';
 }});cache.set(split,result);return result;
}
