import {restoreNativeBRepBoundary3} from './native-boundary3.js';
import type {NativeBRepBoundary3} from './native-boundary3.js';
import {decodeFaceDomain3} from './face-domain3.js';
import type {DecodedFaceDomain3} from './face-domain3.js';
import {faceSupportsAgree3,validateFaceBoundary3} from '../geometry/face-domain-binding3.js';
import {reverseCurve3} from '../geometry/curve3.js';
import type {Curve3} from '../geometry/curve3.js';
import type {RecordReadLimits3} from '../record/schema.js';

export interface NativeBRepFaces3 {readonly boundary:NativeBRepBoundary3;readonly faces:readonly DecodedFaceDomain3[];}
/** Reconstruct bounded analytic face domains and bind their entire oriented
 * boundaries to the serialized uses. Not a shell/region/solid validity claim.
 */
export function restoreNativeBRepFaces3(input:unknown,limits:RecordReadLimits3={}):NativeBRepFaces3 {
  const boundary=restoreNativeBRepBoundary3(input,limits),g=boundary.geometry,r=g.record;
  const faces=Object.freeze(r.faces.map((f,i)=>{
    if(f.domain===undefined)throw new RangeError(`Face ${i} has no bounded domain definition`);
    if(f.parameterBounds!==undefined||f.loops.some(l=>r.loops[l]!.uses.some(u=>u.pcurve!==undefined)))throw new RangeError('Independent pcurve/parameter-bound metadata requires a correspondence validation backend');
    const face=decodeFaceDomain3(f.domain),surface=g.surfaces[f.surface]!;if(surface.kind==='nurbs')throw new RangeError('NURBS face-domain binding is not implemented');
    if(!faceSupportsAgree3(face.surface,face.sense,surface,f.sense,face.sample))throw new RangeError(`Face ${i} domain support or physical orientation disagrees with its surface`);
    const loops=f.loops.map(l=>r.loops[l]!.uses.map(u=>{const edge=r.edges[u.edge]!,curve=g.curves[edge.curve]!;if(curve.kind==='nurbs'||curve.kind==='cylinder-ssi')throw new RangeError('Native face-edge binding does not support NURBS or cylinder SSI');return u.direction===1?curve:reverseCurve3(curve as Curve3);}));
    validateFaceBoundary3(face.surface,face.sense,face.boundary,loops);return face;
  }));
  return Object.freeze({boundary,faces});
}
