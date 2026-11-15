import {preparePlanarSolid3} from '../geometry/planar-solid3.js';
import {booleanPlanarSolids3} from '../geometry/planar-solid-boolean3.js';
import type {BooleanOperation} from '../geometry/polygon-boolean.js';
import {planarSolidFromBoundary3} from '../convert/planar-body3.js';
import {buildBoxBRep3} from '../geometry/box-brep3.js';
import type {Point3} from '../geometry/point3.js';
import type {ExactInput} from '../geometry/point2.js';
import type {Cylinder3} from '../geometry/surface3.js';
import type {CurveRegion2} from '../geometry/curve-boolean2.js';
import {extrudeCurveRegionBRep3,extrudeBetweenBRep3} from '../geometry/extruded-brep3.js';
import type {ExtrudeBRepOptions3} from '../geometry/extruded-brep3.js';
import {clipCylinderBRep3} from '../geometry/clipped-cylinder-brep3.js';
import {adoptExtrudedBody3,adoptCylinderBody3,assertOwnedBody3,adoptPlanarBody3,planarSourceOfBody3} from '../model/body3.js';
import type {Body3} from '../model/body3.js';
import {encodeRationalPoint3,decodeRationalPoint3} from '../convert/exact3.js';
import {encodeBodyProfile3,decodeBodyProfile3} from '../convert/body-profile3.js';
import {constructionRecordsAgree3} from '../convert/body-equivalence3.js';
import {parseBodyDocument3,readBodyDocument3} from '../record/body-document3.js';
import type {BodyConstructionRecord3,BodyDocument3} from '../record/body-document3.js';
import type {RecordReadLimits3} from '../record/schema.js';
import {line3,cylinder3} from '../geometry/surface3.js';

export function createBoxBody3(origin:Point3,width:ExactInput,depth:ExactInput,height:ExactInput):Body3 {
  const box=buildBoxBRep3(origin,width,depth,height);return adoptExtrudedBody3(box.solid,{kind:'box',origin:encodeRationalPoint3(box.origin),size:encodeRationalPoint3(box.size)});
}
/** Lower/upper are parameters of the supplied (possibly non-unit) axis. */
export function createCylinderBody3(cylinder:Cylinder3,lower:ExactInput,upper:ExactInput):Body3 {
  const solid=clipCylinderBRep3(cylinder,lower,upper),c=solid.cylinder;
  return adoptCylinderBody3(solid,{kind:'cylinder',origin:encodeRationalPoint3(c.axis.origin),direction:encodeRationalPoint3(c.axis.direction),radiusSquared:c.radiusSquared.toString(),lower:solid.lower.toString(),upper:solid.upper.toString()});
}
export function extrudeBody3(profile:CurveRegion2,height:ExactInput,options:ExtrudeBRepOptions3={}):Body3 {
  return adoptExtrusion(extrudeCurveRegionBRep3(profile,height,options));
}
function adoptExtrusion(solid:ReturnType<typeof extrudeCurveRegionBRep3>):Body3 {
  return adoptExtrudedBody3(solid,{kind:'extrude',profile:encodeBodyProfile3(solid.region.rings),lower:solid.zMin.toString(),upper:solid.zMax.toString()});
}
export function bodyDocument3(body:Body3):BodyDocument3 {assertOwnedBody3(body);return readBodyDocument3({version:1,construction:body.construction,body:body.record});}
export function serializeBody3(body:Body3):string{return JSON.stringify(bodyDocument3(body));}
function replay(construction:BodyConstructionRecord3):Body3 {
  switch(construction.kind){
    case 'planar':return createPlanarBody3(construction.polygons.map(p=>p.map(decodeRationalPoint3)));
    case 'box':{const s=construction.size;return createBoxBody3(decodeRationalPoint3(construction.origin),s[0],s[1],s[2]);}
    case 'cylinder':return createCylinderBody3(cylinder3(line3(decodeRationalPoint3(construction.origin),decodeRationalPoint3(construction.direction)),construction.radiusSquared),construction.lower,construction.upper);
    case 'extrude':return adoptExtrusion(extrudeBetweenBRep3(decodeBodyProfile3(construction.profile),construction.lower,construction.upper));
  }
}
/** Reconstruct the material, then compare every ordered record field. A stored
 * construction label or closed-incidence flag never suffices for certification.
 * This imports supported construction documents, not arbitrary BodyRecord3 data.
 */
export function restoreBody3(input:unknown,limits:RecordReadLimits3={}):Body3 {
  const document=typeof input==='string'?parseBodyDocument3(input,limits):readBodyDocument3(input,limits),body=replay(document.construction);
  if(!constructionRecordsAgree3(document.body,body.record))throw new RangeError('Stored Body record does not match its reconstructed material');return body;
}

/** Validated manifold rational polygonal material, including cavities/islands. */
export function createPlanarBody3(polygons:readonly (readonly Point3[])[]):Body3 {
  const source=preparePlanarSolid3(polygons);return adoptPlanarBody3(source,{kind:'planar',polygons:source.polygons.map(p=>p.map(encodeRationalPoint3))});
}
/** Common Body operation for rational planar operands. Nonmanifold contact
 * results require the lower-level owned material API until Body region support
 * for contact complexes is implemented; they are never silently discarded.
 */
export function booleanPlanarBodies3(a:Body3,b:Body3,operation:BooleanOperation):Body3 {
  assertOwnedBody3(a);assertOwnedBody3(b);
  const first=planarSourceOfBody3(a)??planarSolidFromBoundary3(a.topology),second=planarSourceOfBody3(b)??planarSolidFromBoundary3(b.topology),result=booleanPlanarSolids3(first,second,operation);
  if(!result.topology.closedOrientedIncidence||result.topology.issues.length)throw new RangeError('Common Body does not yet support nonmanifold contact results; use booleanPlanarSolids3 to retain this material');
  return createPlanarBody3(result.polygons);
}
