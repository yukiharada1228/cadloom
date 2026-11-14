import type {Surface3} from './surface3.js';
import {curveEndpoints3,snapshotCurve3,pointOnCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
import {algebraicSegment3,pointOnAlgebraicSegment3} from './algebraic-segment3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {ellipsesCoincide3,splitEllipticArc3} from './ellipse3.js';
import {canonical,samePoint} from './planar-trim-utils3.js';
import {sectionPieces,witness} from './cylinder-plane-split3.js';
import {buildBRepTopology3} from './brep-topology3.js';
import type {BRepTopology3,BRepEdgeUse3} from './brep-topology3.js';

export interface SewBRepFace3 {readonly surface:Surface3;readonly sense:1|-1;readonly loops:readonly (readonly Curve3[])[];}
export interface SewBRepOptions3 {readonly requireClosed?:boolean;}
export interface SewnBRep3 {
  readonly topology:BRepTopology3;
  /** Face → loop → original curve → oriented sewn edge uses. */
  readonly sourceUses:readonly (readonly (readonly (readonly BRepEdgeUse3[])[])[])[];
  readonly faceLoops:readonly (readonly (readonly BRepEdgeUse3[])[])[];
}
/** Node boundary curves at every supplied endpoint, merge coincident pieces,
 * and build explicit shared-edge incidence. Interior/interior crossings whose
 * intersection is absent from all supplied endpoints are not discovered here.
 * This sews boundary data; it does not certify arbitrary face domains/embedding.
 */
export function sewBRepFaces3(input:readonly SewBRepFace3[],options:SewBRepOptions3={}):SewnBRep3 {
  if(options.requireClosed!==undefined&&typeof options.requireClosed!=='boolean')throw new TypeError('requireClosed must be boolean');
  const prepared=input.map(face=>face.loops.map(loop=>loop.map(c=>sectionPieces(canonical(snapshotCurve3(c)))))),points=prepared.flat(3).flatMap(curveEndpoints3).sort(compareAlgebraicPoints3).filter((p,i,all)=>i===0||!samePoint(p,all[i-1]!)),edges:Curve3[]=[];
  const equalPiece=(a:Curve3,b:Curve3):1|-1|0=>{
    if(a.kind!==b.kind)return 0;const A=curveEndpoints3(a),B=curveEndpoints3(b),direction=samePoint(A[0],B[0])&&samePoint(A[1],B[1])?1:samePoint(A[0],B[1])&&samePoint(A[1],B[0])?-1:0;if(!direction)return 0;
    if(a.kind==='algebraic-segment'&&b.kind==='algebraic-segment')return direction;
    if(a.kind==='elliptic-arc'&&b.kind==='elliptic-arc'&&ellipsesCoincide3(a.arc.ellipse,b.arc.ellipse)&&pointOnCurve3(witness(a),b)&&pointOnCurve3(witness(b),a))return direction;return 0;
  };
  const sourceUses=prepared.map(loops=>Object.freeze(loops.map(loop=>Object.freeze(loop.map(primitives=>{
    const uses:BRepEdgeUse3[]=[];
    for(const primitive of primitives){
      let pieces:readonly Curve3[];
      if(primitive.kind==='elliptic-arc')pieces=splitEllipticArc3(primitive.arc,points.filter(p=>pointOnCurve3(p,primitive))).map(arc=>snapshotCurve3({kind:'elliptic-arc',arc}));
      else if(primitive.kind==='algebraic-segment'){
        const s=primitive.segment,axis=(['x','y','z'] as const).find(k=>s.start[k].compare(s.end[k])!==0);if(axis===undefined)throw new RangeError('Sewn edges must have positive extent');const sign=s.start[axis].compare(s.end[axis])<0?1:-1,cut=points.filter(p=>pointOnAlgebraicSegment3(p,s)).sort((a,b)=>a[axis].compare(b[axis])*sign);
        pieces=cut.slice(0,-1).map((p,i)=>snapshotCurve3({kind:'algebraic-segment',segment:algebraicSegment3(p,cut[i+1]!)}));
      }else throw new Error('Unexpected canonical sewing curve');
      for(const c of pieces){let edge=edges.findIndex(e=>equalPiece(c,e)!==0),direction:1|-1=1;if(edge<0){edge=edges.length;edges.push(c);}else direction=equalPiece(c,edges[edge]!) as 1|-1;uses.push(Object.freeze({edge,direction}));}
    }
    return Object.freeze(uses);
  })))));
  const faceLoops=Object.freeze(sourceUses.map(loops=>Object.freeze(loops.map(loop=>Object.freeze(loop.flat()))))),topology=buildBRepTopology3(edges,input.map((face,i)=>({surface:face.surface,sense:face.sense,loops:faceLoops[i]!})));
  if(options.requireClosed&&(!topology.closedOrientedIncidence||topology.issues.length!==0))throw new RangeError('Sewn boundaries do not form closed oriented manifold incidence');
  return Object.freeze({topology,sourceUses:Object.freeze(sourceUses),faceLoops});
}
