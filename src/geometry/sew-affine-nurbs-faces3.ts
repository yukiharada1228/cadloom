import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {Polynomial} from '../numeric/polynomial.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {intersectAffineNurbsFaceBoundaries3} from './affine-nurbs-boundary-intersection3.js';
import type {AffineNurbsBoundaryIntersection3} from './affine-nurbs-boundary-intersection3.js';
import {assertOwnedAffineNurbsFace3} from './affine-nurbs-face3.js';
import type {AffineNurbsFace3} from './affine-nurbs-face3.js';
import {evaluateNurbsSurfaceBoundaryPiece3} from './nurbs-surface-boundary3.js';
import type {NurbsSurfaceBoundary3,NurbsSurfaceBoundaryPiece3} from './nurbs-surface-boundary3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3,BRepEdgeUse3} from './brep-topology3.js';

export interface AffineNurbsBoundaryEdge3 {readonly boundary:NurbsSurfaceBoundary3;readonly piece:number;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;}
export interface SewnAffineNurbsFaces3 {
 readonly topology:BRepTopology3<AffineNurbsBoundaryEdge3,AffineNurbsFace3>;
 readonly boundaryIntersections:readonly AffineNurbsBoundaryIntersection3[];
 /** Face, ring, original parameter curve, then ordered split-piece uses. */
 readonly sourceUses:readonly (readonly (readonly (readonly BRepEdgeUse3[])[])[])[];
}
function data(e:AffineNurbsBoundaryEdge3):NurbsSurfaceBoundaryPiece3 {return e.boundary.pieces[e.piece]!;}
function ends(e:AffineNurbsBoundaryEdge3){return Object.freeze([evaluateNurbsSurfaceBoundaryPiece3(e.boundary,e.piece,e.lower),evaluateNurbsSurfaceBoundaryPiece3(e.boundary,e.piece,e.upper)] as const);}
function compose(p:Polynomial,t:Polynomial):Polynomial {let result=new Polynomial();for(let i=p.degree;i>=0;i--)result=result.mul(t).add(new Polynomial([p.coefficient(i)]));return result;}
/** Sufficient whole-image identity under a rational affine parameter change.
 * Unsupported parameter correspondences remain distinct edges. */
function match(a:AffineNurbsBoundaryEdge3,b:AffineNurbsBoundaryEdge3):1|-1|0 {
 const A=ends(a),B=ends(b),p=data(a),q=data(b);
 for(const direction of [1,-1] as const){
  if(compareAlgebraicPoints3(A[0],B[direction===1?0:1])!==0||compareAlgebraicPoints3(A[1],B[direction===1?1:0])!==0)continue;
  const start=direction===1?b.lower:b.upper,end=direction===1?b.upper:b.lower;
  const scale=end.sub(start).div(a.upper.sub(a.lower)).recognizeRational().rational;if(scale===null)continue;
  const offset=start.sub(a.lower.affine(scale)).recognizeRational().rational;if(offset===null)continue;
  const t=new Polynomial([offset,scale]),W=compose(q.weight,t);
  if((['x','y','z'] as const).every(k=>p[k].mul(W).equals(compose(q[k],t).mul(p.weight))))return direction;
 }
 return 0;
}
const ownedEdges=new WeakSet<AffineNurbsBoundaryEdge3>();
function edge(boundary:NurbsSurfaceBoundary3,piece:number,lower=boundary.pieces[piece]!.startParameter,upper=boundary.pieces[piece]!.endParameter):AffineNurbsBoundaryEdge3 {const e=Object.freeze({boundary,piece,lower,upper});ownedEdges.add(e);return e;}
/** A nonconstant rational coordinate has finite preimages of an algebraic value.
 * Its annihilator gives all candidates; exact 3D comparison removes conjugates. */
function preimages(e:AffineNurbsBoundaryEdge3,point:AlgebraicCoordinates3):readonly AlgebraicReal[] {
 const p=data(e),keys=(['x','y','z'] as const).filter(k=>p[k].derivative().mul(p.weight).sub(p[k].mul(p.weight.derivative())).degree>=0).sort((a,b)=>point[a].polynomial.degree-point[b].polynomial.degree),key=keys[0];
 if(key===undefined)throw new Error('Embedded boundary piece cannot be constant');
 const N=p[key],W=p.weight,value=point[key].recognizeRational(),P=value.polynomial,NP=[new Polynomial([1n])],WP=[new Polynomial([1n])];
 for(let i=1;i<=P.degree;i++){NP.push(NP[i-1]!.mul(N));WP.push(WP[i-1]!.mul(W));}
 let f=new Polynomial();for(let i=0;i<=P.degree;i++)f=f.add(NP[i]!.mul(WP[P.degree-i]!).scale(P.coefficient(i)));
 if(f.degree<0)throw new Error('Nonconstant coordinate has an identically zero preimage polynomial');
 return isolateRealRoots(f).filter(t=>t.compare(e.lower)>=0&&t.compare(e.upper)<=0&&compareAlgebraicPoints3(evaluateNurbsSurfaceBoundaryPiece3(e.boundary,e.piece,t),point)===0);
}
/** All endpoints and pairwise boundary-intersection events are noded before
 * whole-interval matching. Nonlinear coincidence relations are reported but
 * not merged by the rational-affine matching path. No surface-interior SSI. */
export function sewAffineNurbsFaces3(input:readonly AffineNurbsFace3[]):SewnAffineNurbsFaces3 {
 const faces=Array.from(input,f=>{assertOwnedAffineNurbsFace3(f);return f;}),edges:AffineNurbsBoundaryEdge3[]=[];
 const original=faces.map(face=>face.boundaries.map(ring=>ring.map(boundary=>boundary.pieces.map((_,piece)=>edge(boundary,piece))))),points:AlgebraicCoordinates3[]=[];
 for(const e of original.flat(3))for(const p of ends(e))if(!points.some(q=>compareAlgebraicPoints3(p,q)===0))points.push(p);
 const boundaryIntersections:AffineNurbsBoundaryIntersection3[]=[];
 for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){const report=intersectAffineNurbsFaceBoundaries3(faces[i]!,faces[j]!);boundaryIntersections.push(report);for(const item of report.points)if(!points.some(p=>compareAlgebraicPoints3(p,item.point)===0))points.push(item.point);}
 const split=original.map(rings=>rings.map(ring=>ring.map(pieces=>pieces.flatMap(e=>{
  const cuts=[e.lower,e.upper];for(const p of points)for(const t of preimages(e,p))if(t.compare(e.lower)>0&&t.compare(e.upper)<0&&!cuts.some(q=>t.compare(q)===0))cuts.push(t);
  cuts.sort((a,b)=>a.compare(b));return cuts.slice(0,-1).map((lower,i)=>edge(e.boundary,e.piece,lower,cuts[i+1]!));
 }))));
 const sourceUses=Object.freeze(split.map(rings=>Object.freeze(rings.map(ring=>Object.freeze(ring.map(pieces=>Object.freeze(pieces.map(e=>{
  let direction:1|-1=1,index=edges.findIndex(other=>{const same=match(e,other);if(!same)return false;direction=same;return true;});if(index<0){index=edges.length;edges.push(e);}return Object.freeze({edge:index,direction});
 }))))))));
 const topology=buildBRepTopologyWithGeometryAdapters3(edges,faces.map((surface,f)=>({surface,sense:surface.domain.sense,loops:sourceUses[f]!.map(r=>r.flat())})),{
  snapshot:(e:AffineNurbsBoundaryEdge3)=>e,endpoints:ends,
  closed:e=>{const points=ends(e);return compareAlgebraicPoints3(points[0],points[1])===0;},
  snapshotSurface:(face:AffineNurbsFace3)=>{assertOwnedAffineNurbsFace3(face);return face;},
  onSurface:(e,face)=>split[faces.indexOf(face)]!.flat(2).some(candidate=>match(e,candidate)!==0),
 });
 return Object.freeze({topology,sourceUses,boundaryIntersections:Object.freeze(boundaryIntersections)});
}
/** Closed subinterval evaluation; structural copies cannot broaden the range. */
export function affineNurbsBoundaryEdgePoint3(e:AffineNurbsBoundaryEdge3,parameter:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 if(!ownedEdges.has(e))throw new RangeError('Operation requires a factory-created NURBS boundary edge');const t=parameter instanceof AlgebraicReal?parameter:AlgebraicReal.fromRational(parameter);
 if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the split boundary edge');return evaluateNurbsSurfaceBoundaryPiece3(e.boundary,e.piece,t);
}
