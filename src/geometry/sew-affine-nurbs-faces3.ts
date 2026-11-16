import {Polynomial} from '../numeric/polynomial.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {assertOwnedAffineNurbsFace3} from './affine-nurbs-face3.js';
import type {AffineNurbsFace3} from './affine-nurbs-face3.js';
import {evaluateNurbsSurfaceBoundaryPiece3} from './nurbs-surface-boundary3.js';
import type {NurbsSurfaceBoundary3,NurbsSurfaceBoundaryPiece3} from './nurbs-surface-boundary3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3,BRepEdgeUse3} from './brep-topology3.js';

export interface AffineNurbsBoundaryEdge3 {readonly boundary:NurbsSurfaceBoundary3;readonly piece:number;}
export interface SewnAffineNurbsFaces3 {
 readonly topology:BRepTopology3<AffineNurbsBoundaryEdge3,AffineNurbsFace3>;
 /** Face, ring, original parameter curve, then ordered split-piece uses. */
 readonly sourceUses:readonly (readonly (readonly (readonly BRepEdgeUse3[])[])[])[];
}
function data(e:AffineNurbsBoundaryEdge3):NurbsSurfaceBoundaryPiece3 {return e.boundary.pieces[e.piece]!;}
function ends(e:AffineNurbsBoundaryEdge3){const p=data(e);return Object.freeze([evaluateNurbsSurfaceBoundaryPiece3(e.boundary,e.piece,p.startParameter),evaluateNurbsSurfaceBoundaryPiece3(e.boundary,e.piece,p.endParameter)] as const);}
function compose(p:Polynomial,t:Polynomial):Polynomial {let result=new Polynomial();for(let i=p.degree;i>=0;i--)result=result.mul(t).add(new Polynomial([p.coefficient(i)]));return result;}
/** Sufficient whole-image identity under a rational affine parameter change.
 * Unsupported parameter correspondences remain distinct edges. */
function match(a:AffineNurbsBoundaryEdge3,b:AffineNurbsBoundaryEdge3):1|-1|0 {
 const A=ends(a),B=ends(b),p=data(a),q=data(b);
 for(const direction of [1,-1] as const){
  if(compareAlgebraicPoints3(A[0],B[direction===1?0:1])!==0||compareAlgebraicPoints3(A[1],B[direction===1?1:0])!==0)continue;
  const start=direction===1?q.startParameter:q.endParameter,end=direction===1?q.endParameter:q.startParameter;
  const scale=end.sub(start).div(p.endParameter.sub(p.startParameter)).recognizeRational().rational;if(scale===null)continue;
  const offset=start.sub(p.startParameter.affine(scale)).recognizeRational().rational;if(offset===null)continue;
  const t=new Polynomial([offset,scale]),W=compose(q.weight,t);
  if((['x','y','z'] as const).every(k=>p[k].mul(W).equals(compose(q[k],t).mul(p.weight))))return direction;
 }
 return 0;
}
/** Reuse common BRep incidence for owned embedded NURBS faces. Shares complete
 * boundary pieces certified by polynomial identities. No automatic noding at
 * other faces' interior endpoints, nonlinear reparameterization, intersection
 * detection, shell embedding, containment or material certification. */
export function sewAffineNurbsFaces3(input:readonly AffineNurbsFace3[]):SewnAffineNurbsFaces3 {
 const faces=Array.from(input,f=>{assertOwnedAffineNurbsFace3(f);return f;}),edges:AffineNurbsBoundaryEdge3[]=[];
 const sourceUses=Object.freeze(faces.map(face=>Object.freeze(face.boundaries.map(ring=>Object.freeze(ring.map(boundary=>Object.freeze(boundary.pieces.map((_,piece)=>{
  const edge=Object.freeze({boundary,piece});let direction:1|-1=1,index=edges.findIndex(other=>{const same=match(edge,other);if(!same)return false;direction=same;return true;});if(index<0){index=edges.length;edges.push(edge);}return Object.freeze({edge:index,direction});
 }))))))));
 const topology=buildBRepTopologyWithGeometryAdapters3(edges,faces.map((surface,f)=>({surface,sense:surface.domain.sense,loops:sourceUses[f]!.map(r=>r.flat())})),{
  snapshot:(edge:AffineNurbsBoundaryEdge3)=>edge,endpoints:ends,
  closed:edge=>{const e=ends(edge);return compareAlgebraicPoints3(e[0],e[1])===0;},
  snapshotSurface:(face:AffineNurbsFace3)=>{assertOwnedAffineNurbsFace3(face);return face;},
  onSurface:(edge,face)=>face.boundaries.some(r=>r.some(boundary=>boundary.pieces.some((_,piece)=>match(edge,{boundary,piece})!==0))),
 });
 return Object.freeze({topology,sourceUses});
}
