import type {Surface3} from './surface3.js';
import {snapshotBRepCurve3,nativeBRepCurve3,cylinderIntersectionBRepCurve3,brepCurveEndpoints3,pointOnBRepCurve3,brepCurveOnSurface3,buildMixedBRepTopology3} from './brep-curve3.js';
import type {BRepCurve3} from './brep-curve3.js';
import {restrictAlgebraicSegment3,algebraicSegment3,pointOnAlgebraicSegment3} from './algebraic-segment3.js';
import {compareAlgebraicPoints3,getPointParameterization3,getRationalParameterization3,getBiparameterization3} from './algebraic-point3.js';
import {ellipsesCoincide3,splitEllipticArc3} from './ellipse3.js';
import {curveOnSurface3} from './curve3.js';
import {canonical,samePoint} from './planar-trim-utils3.js';
import {sectionPieces,witness} from './cylinder-plane-split3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {splitCylinderIntersectionArc3,cylinderIntersectionPointCylinders3} from './cylinder-cylinder3.js';
import type {BRepTopology3,BRepEdgeUse3} from './brep-topology3.js';
import type {SewBRepOptions3,SewnBRep3} from './sew-brep3.js';

export interface MixedBRepFace3 {readonly surface:Surface3;readonly sense:1|-1;readonly loops:readonly (readonly BRepCurve3[])[];}
export interface SewnMixedBRep3 {
  readonly topology:BRepTopology3<BRepCurve3>;
  readonly sourceUses:SewnBRep3['sourceUses'];
  readonly faceLoops:SewnBRep3['faceLoops'];
}
/** Equal values may have different construction records. Preserve useful
 * immutable support/field provenance instead of retaining an arbitrary copy. */
function preferredPoints(input:readonly AlgebraicCoordinates3[]):AlgebraicCoordinates3[] {
 const rank=(p:AlgebraicCoordinates3)=>cylinderIntersectionPointCylinders3(p)?4:getRationalParameterization3(p)?3:getPointParameterization3(p)?2:getBiparameterization3(p)?1:0,result:AlgebraicCoordinates3[]=[];
 for(const p of [...input].sort(compareAlgebraicPoints3)){const previous=result[result.length-1];if(previous&&samePoint(previous,p)){if(rank(p)>rank(previous))result[result.length-1]=p;}else result.push(p);}return result;
}
function sample(curve:BRepCurve3){return curve.kind==='native'?witness(curve.curve):curve.arc.sample;}
function sameSupport(a:BRepCurve3,b:BRepCurve3):boolean {
  if(a.kind==='native'&&b.kind==='native'){
    if(a.curve.kind==='algebraic-segment'&&b.curve.kind==='algebraic-segment')return true;
    return a.curve.kind==='elliptic-arc'&&b.curve.kind==='elliptic-arc'&&ellipsesCoincide3(a.curve.arc.ellipse,b.curve.arc.ellipse);
  }
  if(a.kind==='cylinder-ssi'&&b.kind==='cylinder-ssi')return [a.arc.first,a.arc.second].every(c=>brepCurveOnSurface3(b,{kind:'cylinder',cylinder:c}))&&[b.arc.first,b.arc.second].every(c=>brepCurveOnSurface3(a,{kind:'cylinder',cylinder:c}));
  const native=a.kind==='native'?a:b,ssi=a.kind==='cylinder-ssi'?a:b;
  return native.kind==='native'&&ssi.kind==='cylinder-ssi'&&[ssi.arc.first,ssi.arc.second].every(c=>curveOnSurface3(native.curve,{kind:'cylinder',cylinder:c}));
}
/** Node supplied endpoints, merge certified coincident native/SSI pieces and
 * build shared-edge/coedge incidence. Preserves original curve-use provenance.
 * No arbitrary missing interior/interior crossings, bounded face validity or
 * global shell/material embedding is inferred from closed incidence.
 */
export function sewMixedBRepFaces3(input:readonly MixedBRepFace3[],options:SewBRepOptions3={}):SewnMixedBRep3 {
  if(options.requireClosed!==undefined&&typeof options.requireClosed!=='boolean')throw new TypeError('requireClosed must be boolean');
  const prepared=input.map(f=>f.loops.map(loop=>loop.map(c=>{const p=snapshotBRepCurve3(c);return p.kind==='native'?sectionPieces(canonical(p.curve)).map(nativeBRepCurve3):[p];}))),points=preferredPoints(prepared.flat(3).flatMap(brepCurveEndpoints3)),edges:BRepCurve3[]=[];
  // Prepared and split curves are owned immutable snapshots. Reuse the exact
  // witness only within this sewing call; no caller-mutable keys escape it.
  const samples=new Map<BRepCurve3,AlgebraicCoordinates3>();
  function sampled(curve:BRepCurve3):AlgebraicCoordinates3 {let point=samples.get(curve);if(!point){point=sample(curve);samples.set(curve,point);}return point;}
  function equal(a:BRepCurve3,b:BRepCurve3):1|-1|0 {
    const A=brepCurveEndpoints3(a),B=brepCurveEndpoints3(b),direction=samePoint(A[0],B[0])&&samePoint(A[1],B[1])?1:samePoint(A[0],B[1])&&samePoint(A[1],B[0])?-1:0;
    if(!direction||!sameSupport(a,b))return 0;
    if(a.kind==='native'&&b.kind==='native'&&a.curve.kind==='algebraic-segment'&&b.curve.kind==='algebraic-segment')return direction;
    return pointOnBRepCurve3(sampled(a),b)&&pointOnBRepCurve3(sampled(b),a)?direction:0;
  }
  const sourceUses=Object.freeze(prepared.map(loops=>Object.freeze(loops.map(loop=>Object.freeze(loop.map(primitives=>{
    const uses:BRepEdgeUse3[]=[];
    for(const primitive of primitives){
      let pieces:readonly BRepCurve3[];
      if(primitive.kind==='cylinder-ssi'){
        const arcs=splitCylinderIntersectionArc3(primitive.arc,points.filter(p=>pointOnBRepCurve3(p,primitive))),ordered=primitive.direction===1?arcs:[...arcs].reverse();pieces=ordered.map(a=>cylinderIntersectionBRepCurve3(a,primitive.direction));
      }else if(primitive.curve.kind==='elliptic-arc')pieces=splitEllipticArc3(primitive.curve.arc,points.filter(p=>pointOnBRepCurve3(p,primitive))).map(arc=>nativeBRepCurve3({kind:'elliptic-arc',arc}));
      else if(primitive.curve.kind==='algebraic-segment'){
        const s=primitive.curve.segment,axis=(['x','y','z'] as const).find(k=>s.start[k].compare(s.end[k])!==0);if(axis===undefined)throw new RangeError('Sewn edges must have positive extent');const direction=s.start[axis].compare(s.end[axis])<0?1:-1,cut=points.filter(p=>pointOnAlgebraicSegment3(p,s)).sort((a,b)=>a[axis].compare(b[axis])*direction);
        pieces=cut.slice(0,-1).map((p,i)=>nativeBRepCurve3({kind:'algebraic-segment',segment:restrictAlgebraicSegment3(s,p,cut[i+1]!)}));
      }else throw new Error('Unexpected canonical mixed sewing curve');
      for(const c of pieces){let direction:1|-1=1;let edge=edges.findIndex(e=>{const match=equal(c,e);if(match===0)return false;direction=match;return true;});if(edge<0){edge=edges.length;edges.push(c);}uses.push(Object.freeze({edge,direction}));}
    }
    return Object.freeze(uses);
  }))))));
  const faceLoops=Object.freeze(sourceUses.map(loops=>Object.freeze(loops.map(loop=>Object.freeze(loop.flat()))))),topology=buildMixedBRepTopology3(edges,input.map((f,i)=>({surface:f.surface,sense:f.sense,loops:faceLoops[i]!})));
  if(options.requireClosed&&(!topology.closedOrientedIncidence||topology.issues.length))throw new RangeError('Mixed boundaries do not form closed oriented manifold incidence');
  return Object.freeze({topology,sourceUses,faceLoops});
}
