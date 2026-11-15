import {restoreMixedBRepBoundary3} from './mixed-boundary3.js';
import type {MixedBRepBoundary3} from './mixed-boundary3.js';
import {decodeMixedFaceDomain3} from './mixed-face-domain3.js';
import type {DecodedMixedFaceDomain3} from './mixed-face-domain3.js';
import {faceSupportsAgree3} from '../geometry/face-domain-binding3.js';
import {validateMixedFaceBoundary3} from '../geometry/mixed-face-domain-binding3.js';
import {reverseBRepCurve3,nativeBRepCurve3} from '../geometry/brep-curve3.js';
import type {RecordReadLimits3} from '../record/schema.js';

export interface MixedBRepFaces3 {readonly boundary:MixedBRepBoundary3;readonly faces:readonly DecodedMixedFaceDomain3[];}
const owned=new WeakSet<MixedBRepFaces3>();
export function assertOwnedMixedBRepFaces3(input:MixedBRepFaces3):void {if(!owned.has(input))throw new RangeError('Expected factory-restored mixed BRep faces');}
/** Reconstruct bounded analytic face domains and bind their entire oriented
 * boundaries to the serialized uses. Not a shell/region/solid validity claim.
 */
export function restoreMixedBRepFaces3(input:unknown,limits:RecordReadLimits3={}):MixedBRepFaces3 {
  const boundary=restoreMixedBRepBoundary3(input,limits),g=boundary.geometry,r=g.record;
  const faces=Object.freeze(r.faces.map((f,i)=>{
    if(f.domain===undefined)throw new RangeError(`Face ${i} has no bounded domain definition`);
    if(f.parameterBounds!==undefined||f.loops.some(l=>r.loops[l]!.uses.some(u=>u.pcurve!==undefined)))throw new RangeError('Independent pcurve/parameter-bound metadata requires a correspondence validation backend');
    const face=decodeMixedFaceDomain3(f.domain),surface=g.surfaces[f.surface]!;if(surface.kind==='nurbs')throw new RangeError('NURBS face-domain binding is not implemented');
    if(!faceSupportsAgree3(face.surface,face.sense,surface,f.sense,face.sample))throw new RangeError(`Face ${i} domain support or physical orientation disagrees with its surface`);
    const loops=f.loops.map(l=>r.loops[l]!.uses.map(u=>{const edge=r.edges[u.edge]!,curve=g.curves[edge.curve]!;if(curve.kind==='nurbs')throw new RangeError('Mixed face-edge binding does not support NURBS');const c=curve.kind==='cylinder-ssi'?curve:nativeBRepCurve3(curve);return u.direction===1?c:reverseBRepCurve3(c);}));
    validateMixedFaceBoundary3(face.surface,face.sense,face.boundary,loops);const shell=r.shells.find(s=>s.kind==='faces'&&s.faces.some(u=>u.face===i)),direction=shell?.kind==='faces'?shell.faces.find(u=>u.face===i)!.direction:1;return direction===1?face:Object.freeze({...face,sense:-face.sense as 1|-1,boundary:Object.freeze(face.boundary.map(loop=>Object.freeze([...loop].reverse().map(reverseBRepCurve3))))});
  }));
  const result=Object.freeze({boundary,faces});owned.add(result);return result;
}
