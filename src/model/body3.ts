import type {Point3} from '../geometry/point3.js';
import {snapshotExactPoint3} from '../geometry/algebraic-point3.js';
import type {AlgebraicCoordinates3} from '../geometry/algebraic-point3.js';
import type {CurveRegionLocation2} from '../geometry/curve-boolean2.js';
import {assertOwnedExtrudedBRep3} from '../geometry/extruded-brep3.js';
import type {ExtrudedBRep3} from '../geometry/extruded-brep3.js';
import {assertOwnedClippedCylinder3} from '../geometry/clipped-cylinder-brep3.js';
import type {ClippedCylinderBRep3} from '../geometry/clipped-cylinder-brep3.js';
import type {BRepTopology3} from '../geometry/brep-topology3.js';
import {bodyRecordFromTopology3} from '../convert/body3.js';
import {restoreNativeBRepBoundary3} from '../convert/native-boundary3.js';
import type {DecodedBodyGeometry3} from '../convert/body3.js';
import type {BodyRecord3} from '../record/body3.js';
import {readBodyDocument3} from '../record/body-document3.js';
import type {BodyConstructionRecord3} from '../record/body-document3.js';

export interface Body3 {
  readonly record:BodyRecord3;readonly geometry:DecodedBodyGeometry3;readonly topology:BRepTopology3;
  /** Reconstructible, normalized material definition; not feature history. */
  readonly construction:BodyConstructionRecord3;
  readonly interiorSamples:readonly AlgebraicCoordinates3[];
}
type Location=(point:Point3|AlgebraicCoordinates3)=>CurveRegionLocation2;
const states=new WeakMap<Body3,{locate:Location;faces:readonly Location[]}>();
function state(body:Body3){const data=states.get(body);if(!data)throw new RangeError('Operation requires a factory-created Body');return data;}
export function assertOwnedBody3(body:Body3):void {state(body);}
export function locateBody3(body:Body3,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2{return state(body).locate(point);}
/** Location relative to one bounded face, not relative to solid material. */
export function locateBodyFace3(body:Body3,face:number,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {
  const s=state(body);if(!Number.isSafeInteger(face)||face<0||face>=s.faces.length)throw new RangeError('Invalid Body face index');return s.faces[face]!(point);
}
function publish(topology:BRepTopology3,locate:Location,faces:readonly Location[],samples:readonly AlgebraicCoordinates3[],construction:BodyConstructionRecord3):Body3 {
  // Region roles follow the constructors' product/convex embedding arguments,
  // never arbitrary caller-provided incidence flags.
  const ids=topology.shells.map((_,i)=>i),regions=[{shells:ids,void:false},...ids.map(i=>({shells:[i],void:false}))],record=bodyRecordFromTopology3(topology,regions),rebuilt=restoreNativeBRepBoundary3(record);
  if(!rebuilt.topology.closedOrientedIncidence||rebuilt.topology.issues.length||faces.length!==record.faces.length||samples.length!==ids.length||samples.some(p=>locate(p)!=='inside'))throw new Error('Constructed Body representation invariant failed');
  const document=readBodyDocument3({version:1,construction,body:record}),result=Object.freeze({record:rebuilt.geometry.record,geometry:rebuilt.geometry,topology:rebuilt.topology,construction:document.construction,interiorSamples:Object.freeze([...samples])});states.set(result,{locate,faces:Object.freeze([...faces])});return result;
}
/** Internal adoption endpoints; public ops obtain the source from kernel factories. */
export function adoptExtrudedBody3(source:ExtrudedBRep3,construction:BodyConstructionRecord3):Body3 {
  assertOwnedExtrudedBRep3(source);return publish(source.topology,p=>source.locate(p),source.faces.map(f=>p=>f.face.locate(p)),source.samples,construction);
}
export function adoptCylinderBody3(source:ClippedCylinderBRep3,construction:BodyConstructionRecord3):Body3 {
  assertOwnedClippedCylinder3(source);return publish(source.topology,p=>source.locate(p),source.faces.map(f=>p=>f.domain.components[f.component]!.locate(p)),source.interiorSample?[snapshotExactPoint3(source.interiorSample)]:[],construction);
}
