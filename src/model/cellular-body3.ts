import type {CellularBodyRecord3} from '../record/cellular-body3.js';
import type {NativeBRepFaces3} from '../convert/native-faces3.js';
import type {Point3} from '../geometry/point3.js';
import type {AlgebraicCoordinates3} from '../geometry/algebraic-point3.js';
import type {CurveRegionLocation2} from '../geometry/curve-boolean2.js';

/** Owned cellular Body; material certification is established by construction ops. */
export interface CellularBody3 {
 readonly kind:'cellular-body';readonly record:CellularBodyRecord3;
 readonly topology:NativeBRepFaces3['boundary']['topology'];readonly faces:NativeBRepFaces3['faces'];
 readonly materialFaces:readonly number[];readonly interiorSamples:readonly Point3[];
}
type Location=(point:Point3|AlgebraicCoordinates3)=>CurveRegionLocation2;
const locations=new WeakMap<CellularBody3,Location>();
/** Internal publication after geometric region analysis and complete face binding. */
export function adoptCellularBody3(body:CellularBody3,locate:Location):CellularBody3 {
 if(!Object.isFrozen(body)||!Object.isFrozen(body.record)||body.faces.length!==body.record.faceRegions.length||body.materialFaces.length!==body.faces.length)throw new Error('Cellular Body publication invariant failed');
 locations.set(body,locate);return body;
}
export function isOwnedCellularBody3(value:unknown):value is CellularBody3 {return value!==null&&typeof value==='object'&&locations.has(value as CellularBody3);}
function location(body:CellularBody3):Location {const locate=locations.get(body);if(!locate)throw new RangeError('Operation requires a factory-created cellular Body');return locate;}
export function locateOwnedCellularBody3(body:CellularBody3,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {return location(body)(point);}
export function locateOwnedCellularBodyFace3(body:CellularBody3,face:number,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {
 location(body);if(!Number.isSafeInteger(face)||face<0||face>=body.faces.length)throw new RangeError('Invalid Body face index');return body.faces[face]!.locate(point);
}
