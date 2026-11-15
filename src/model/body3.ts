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
import {restoreNativeBRepFaces3} from '../convert/native-faces3.js';
import {encodePlanarDomain3,encodeCylinderDomain3,encodeTrimmedPlanarDomain3,encodeTrimmedCylinderDomain3} from '../convert/face-domain3.js';
import type {DecodedFaceDomain3} from '../convert/face-domain3.js';
import {readBodyRecord3} from '../record/body3.js';
import type {FaceDomainRecord3} from '../record/face-domain3.js';
import type {DecodedBodyGeometry3} from '../convert/body3.js';
import type {BodyRegionRecord3} from '../record/body3.js';
import {assertOwnedPlanarSolid3} from '../geometry/planar-solid3.js';
import type {PreparedPlanarSolid3} from '../geometry/planar-solid3.js';
import {planarSolidRegions3} from '../geometry/planar-solid-regions3.js';
import {createExactPlanarLocator3} from '../geometry/exact-planar-location3.js';
import {encodePlanarPolygonDomain3} from '../convert/planar-body3.js';
import type {BodyRecord3} from '../record/body3.js';
import {readBodyDocument3} from '../record/body-document3.js';
import type {BodyConstructionRecord3} from '../record/body-document3.js';

export interface Body3 {
  readonly record:BodyRecord3;readonly geometry:DecodedBodyGeometry3;readonly topology:BRepTopology3;
  /** Reconstructible, normalized material definition; not feature history. */
  readonly construction:BodyConstructionRecord3;
  readonly interiorSamples:readonly AlgebraicCoordinates3[];readonly faces:readonly DecodedFaceDomain3[];
}
type Location=(point:Point3|AlgebraicCoordinates3)=>CurveRegionLocation2;
const states=new WeakMap<Body3,{locate:Location;faces:readonly Location[];planar:PreparedPlanarSolid3|undefined}>();
function state(body:Body3){const data=states.get(body);if(!data)throw new RangeError('Operation requires a factory-created Body');return data;}
export function assertOwnedBody3(body:Body3):void {state(body);}
export function locateBody3(body:Body3,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2{return state(body).locate(point);}
/** Location relative to one bounded face, not relative to solid material. */
export function locateBodyFace3(body:Body3,face:number,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {
  const s=state(body);if(!Number.isSafeInteger(face)||face<0||face>=s.faces.length)throw new RangeError('Invalid Body face index');return s.faces[face]!(point);
}
function publish(topology:BRepTopology3,locate:Location,domains:readonly FaceDomainRecord3[],samples:readonly AlgebraicCoordinates3[],construction:BodyConstructionRecord3,material?:{regions:readonly BodyRegionRecord3[];planar:PreparedPlanarSolid3}):Body3 {
  // Region roles follow constructive product/convex provenance or validated
  // polygonal shell nesting, never arbitrary caller-provided incidence flags.
  const ids=topology.shells.map((_,i)=>i),regions=material?.regions??[{shells:ids,void:false},...ids.map(i=>({shells:[i],void:false}))],raw=bodyRecordFromTopology3(topology,regions);
  if(domains.length!==raw.faces.length)throw new Error('Constructed face-domain table is incomplete');
  const record=readBodyRecord3({...raw,faces:raw.faces.map((f,i)=>({...f,domain:domains[i]!}))}),restored=restoreNativeBRepFaces3(record),rebuilt=restored.boundary,faces=restored.faces;
  if(!rebuilt.topology.closedOrientedIncidence||rebuilt.topology.issues.length||faces.length!==record.faces.length||samples.length!==regions.slice(1).filter(r=>!r.void).length||samples.some(p=>locate(p)!=='inside'))throw new Error('Constructed Body representation invariant failed');
  const document=readBodyDocument3({version:1,construction,body:record}),result=Object.freeze({record:rebuilt.geometry.record,geometry:rebuilt.geometry,topology:rebuilt.topology,construction:document.construction,interiorSamples:Object.freeze([...samples]),faces});states.set(result,{locate,planar:material?.planar,faces:Object.freeze(faces.map(f=>(p:Point3|AlgebraicCoordinates3)=>f.locate(p)))});return result;
}
/** Internal adoption endpoints; public ops obtain the source from kernel factories. */
export function adoptExtrudedBody3(source:ExtrudedBRep3,construction:BodyConstructionRecord3):Body3 {
  assertOwnedExtrudedBRep3(source);return publish(source.topology,p=>source.locate(p),source.faces.map(f=>f.kind==='planar'?encodePlanarDomain3(f.face):encodeCylinderDomain3(f.face)),source.samples,construction);
}
export function adoptCylinderBody3(source:ClippedCylinderBRep3,construction:BodyConstructionRecord3):Body3 {
  assertOwnedClippedCylinder3(source);return publish(source.topology,p=>source.locate(p),source.faces.map(f=>f.kind==='planar'?encodeTrimmedPlanarDomain3(f.domain,f.component):encodeTrimmedCylinderDomain3(f.domain,f.component)),source.interiorSample?[snapshotExactPoint3(source.interiorSample)]:[],construction);
}

/** Internal accessor: ownership is checked even when no planar cache exists. */
export function planarSourceOfBody3(body:Body3):PreparedPlanarSolid3|undefined{return state(body).planar;}
export function adoptPlanarBody3(source:PreparedPlanarSolid3,construction:BodyConstructionRecord3):Body3 {
  assertOwnedPlanarSolid3(source);const material=planarSolidRegions3(source),domains=source.polygons.map((p,i)=>{const s=source.topology.faces[i]!.surface;if(s.kind!=='plane')throw new Error('Planar Body has curved support');return encodePlanarPolygonDomain3(p,s.plane.normal);});
  return publish(source.topology,createExactPlanarLocator3(source.triangles),domains,material.samples.map(snapshotExactPoint3),construction,{regions:material.regions,planar:source});
}
