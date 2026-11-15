import {cylinderSourceOfBody3} from '../model/body3.js';
import type {Body3} from '../model/body3.js';
import {bodyFromClippedCylinder3} from './body3.js';
import {splitClippedCylinderByPlane3,rejoinClippedCylinderSplit3} from '../geometry/clipped-cylinder-split3.js';
import type {ClippedCylinderPlaneSplit3,CylinderSplitInterface3,RejoinedCylinderSplit3} from '../geometry/clipped-cylinder-split3.js';
import type {Plane3} from '../geometry/plane3.js';

interface CylinderBodySplitBase3 {
  readonly parent:Body3;readonly plane:Plane3;
  readonly negative:Body3;readonly positive:Body3;
  /** Child Body face → immediate parent Body face; null is the new cut facet. */
  readonly negativeFaceOrigins:readonly (number|null)[];
  readonly positiveFaceOrigins:readonly (number|null)[];
}
export type CylinderBodyPlaneSplit3=CylinderBodySplitBase3&(
 | {readonly kind:'split';readonly shared:CylinderSplitInterface3}
 | {readonly kind:'touching'|'disjoint';readonly materialSide:-1|1;readonly shared:null}
 | {readonly kind:'empty';readonly shared:null});
export interface RejoinedCylinderBodySplit3 {
  readonly body:Body3;
  readonly sewing:RejoinedCylinderSplit3['sewing'];
  readonly faces:RejoinedCylinderSplit3['faces'];
}
const splits=new WeakMap<CylinderBodyPlaneSplit3,ClippedCylinderPlaneSplit3>();
/** Plane-cut a factory-created cylinder/halfspace Body into closed child Bodies.
 * Interface face/coedge IDs refer to the returned children, with exact opposite
 * orientation and shared edge subdivision maps. Children persist and can be cut
 * again. This family dispatch is not arbitrary surface/surface Boolean support.
 */
export function splitCylinderBodyByPlane3(body:Body3,plane:Plane3):CylinderBodyPlaneSplit3 {
  const source=cylinderSourceOfBody3(body),native=splitClippedCylinderByPlane3(source,plane),child=(s:typeof source)=>s===source?body:bodyFromClippedCylinder3(s);
  const base={parent:body,plane:native.plane,negative:child(native.negative),positive:child(native.positive),negativeFaceOrigins:native.negativeFaceOrigins,positiveFaceOrigins:native.positiveFaceOrigins};
  if(base.negative.faces.length!==base.negativeFaceOrigins.length||base.positive.faces.length!==base.positiveFaceOrigins.length)throw new Error('Body/native split face indices disagree');
  const result:CylinderBodyPlaneSplit3=Object.freeze(native.kind==='split'?{...base,kind:'split',shared:native.shared}:native.kind==='empty'?{...base,kind:'empty',shared:null}:{...base,kind:native.kind,materialSide:native.materialSide,shared:null});
  splits.set(result,native);return result;
}
/** Cancel the owned split's paired caps and independently re-sew its outer
 * boundary. Returns the original material Body; this is an inverse cut, not a
 * general union of unrelated children or independently loaded split metadata.
 */
export function rejoinCylinderBodySplit3(split:CylinderBodyPlaneSplit3):RejoinedCylinderBodySplit3 {
  const native=splits.get(split);if(!native)throw new RangeError('Rejoining requires a factory-created cylinder Body split');
  const joined=rejoinClippedCylinderSplit3(native);
  return Object.freeze({body:split.parent,sewing:joined.sewing,faces:joined.faces});
}
