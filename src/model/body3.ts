import {isOwnedCellularBody3,locateOwnedCellularBody3,locateOwnedCellularBodyFace3} from './cellular-body3.js';
import type {CellularBody3} from './cellular-body3.js';
import {locateMaterialSurfaceBoundary3} from '../geometry/material-surface-boundary3.js';
import type {MaterialSurfaceBoundary3} from '../geometry/material-surface-boundary3.js';
import {resolveCylinderMaterialProgram3} from '../geometry/cylinder-material-expression3.js';
import {materialSurfaceRegions3} from '../geometry/finite-cylinder-regions3.js';
import type {CylinderMaterialBoundary3} from '../geometry/cylinder-material-expression3.js';
import type {ClippedCylinderExpression3} from '../geometry/clipped-cylinder-expression3.js';
import type {CylinderHalfSpace3} from '../geometry/trimmed-cylinder3.js';
import type {CylinderExpressionPlaneSplit3} from '../geometry/cylinder-expression-plane-split3.js';
import {assertOwnedFiniteCylinderExpressionBoundary3,locateFiniteCylinderExpression3} from '../geometry/finite-cylinder-expression3.js';
import type {FiniteCylinderExpressionBoundary3} from '../geometry/finite-cylinder-expression3.js';
import type {Curve3} from '../geometry/curve3.js';
import type {BRepCurve3} from '../geometry/brep-curve3.js';
import type {DecodedMixedFaceDomain3} from '../convert/mixed-face-domain3.js';
import {cylinderMaterialRegions3,clippedCylinderExpressionRegions3,finiteCylinderExpressionSplitRegions3,finiteCylinderRegionFaces3,finiteCylinderExpressionRegions3,finiteCylinderBooleanRegions3} from '../geometry/finite-cylinder-regions3.js';
import {assertOwnedFiniteCylinderBoolean3} from '../geometry/finite-cylinder-boolean3.js';
import type {FiniteCylinderBoolean3,FiniteCylinder3} from '../geometry/finite-cylinder-boolean3.js';
import {encodeRationalPoint3} from '../convert/exact3.js';
import {assertOwnedConsolidatedPlanarSolid3} from '../geometry/consolidate-planar-solid3.js';
import type {ConsolidatedPlanarSolid3} from '../geometry/consolidate-planar-solid3.js';
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
  readonly record:BodyRecord3;readonly geometry:DecodedBodyGeometry3;readonly topology:BRepTopology3<Curve3|BRepCurve3>;
  /** Reconstructible, normalized material definition; not feature history. */
  readonly construction:BodyConstructionRecord3;
  readonly interiorSamples:readonly AlgebraicCoordinates3[];readonly faces:readonly (DecodedFaceDomain3|DecodedMixedFaceDomain3)[];
}
export type KernelBody3=Body3|CellularBody3;
type Location=(point:Point3|AlgebraicCoordinates3)=>CurveRegionLocation2;
const states=new WeakMap<Body3,{locate:Location;faces:readonly Location[];planar:PreparedPlanarSolid3|undefined;cylinder:ClippedCylinderBRep3|undefined;nativeTopology:BRepTopology3|undefined;finiteCylinderBoolean:FiniteCylinderBoolean3|undefined;finiteCylinderExpression?:FiniteCylinderExpressionBoundary3;clippedExpression?:ClippedCylinderExpression3;material?:CylinderMaterialBoundary3;materialSurface?:MaterialSurfaceBoundary3;planeCutExpression?:Readonly<{source:FiniteCylinderExpressionBoundary3;cut:CylinderHalfSpace3}>}>();
function state(body:Body3){const data=states.get(body);if(!data)throw new RangeError('Operation requires a factory-created Body');return data;}
export function assertOwnedBody3(body:Body3):void {state(body);}
export function locateBody3(body:KernelBody3,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2{return isOwnedCellularBody3(body)?locateOwnedCellularBody3(body,point):state(body).locate(point);}
/** Location relative to one bounded face, not relative to solid material. */
export function locateBodyFace3(body:KernelBody3,face:number,point:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {
  if(isOwnedCellularBody3(body))return locateOwnedCellularBodyFace3(body,face,point);
  const s=state(body);if(!Number.isSafeInteger(face)||face<0||face>=s.faces.length)throw new RangeError('Invalid Body face index');return s.faces[face]!(point);
}
function publish(topology:BRepTopology3,locate:Location,domains:readonly FaceDomainRecord3[],samples:readonly AlgebraicCoordinates3[],construction:BodyConstructionRecord3,material?:{regions:readonly BodyRegionRecord3[];planar:PreparedPlanarSolid3},cylinder?:ClippedCylinderBRep3):Body3 {
  // Region roles follow constructive product/convex provenance or validated
  // polygonal shell nesting, never arbitrary caller-provided incidence flags.
  const ids=topology.shells.map((_,i)=>i),regions=material?.regions??[{shells:ids,void:false},...ids.map(i=>({shells:[i],void:false}))],raw=bodyRecordFromTopology3(topology,regions);
  if(domains.length!==raw.faces.length)throw new Error('Constructed face-domain table is incomplete');
  const record=readBodyRecord3({...raw,faces:raw.faces.map((f,i)=>({...f,domain:domains[i]!}))}),restored=restoreNativeBRepFaces3(record),rebuilt=restored.boundary,faces=restored.faces;
  if(!rebuilt.topology.closedOrientedIncidence||rebuilt.topology.issues.length||faces.length!==record.faces.length||samples.length!==regions.slice(1).filter(r=>!r.void).length||samples.some(p=>locate(p)!=='inside'))throw new Error('Constructed Body representation invariant failed');
  const document=readBodyDocument3({version:1,construction,body:record}),result=Object.freeze({record:rebuilt.geometry.record,geometry:rebuilt.geometry,topology:rebuilt.topology,construction:document.construction,interiorSamples:Object.freeze([...samples]),faces});states.set(result,{locate,cylinder,nativeTopology:rebuilt.topology,finiteCylinderBoolean:undefined,planar:material?.planar,faces:Object.freeze(faces.map(f=>(p:Point3|AlgebraicCoordinates3)=>f.locate(p)))});return result;
}
/** Internal adoption endpoints; public ops obtain the source from kernel factories. */
const extrusionSources=new WeakMap<Body3,ExtrudedBRep3>();
export function extrusionSourceOfBody3(body:Body3):ExtrudedBRep3|undefined {state(body);return extrusionSources.get(body);}
export function adoptExtrudedBody3(source:ExtrudedBRep3,construction:BodyConstructionRecord3):Body3 {
  assertOwnedExtrudedBRep3(source);const body=publish(source.topology,p=>source.locate(p),source.faces.map(f=>f.kind==='planar'?encodePlanarDomain3(f.face):encodeCylinderDomain3(f.face)),source.samples,construction);extrusionSources.set(body,source);return body;
}
export function adoptCylinderBody3(source:ClippedCylinderBRep3,construction:BodyConstructionRecord3):Body3 {
  assertOwnedClippedCylinder3(source);return publish(source.topology,p=>source.locate(p),source.faces.map(f=>f.kind==='planar'?encodeTrimmedPlanarDomain3(f.domain,f.component):encodeTrimmedCylinderDomain3(f.domain,f.component)),source.interiorSample?[snapshotExactPoint3(source.interiorSample)]:[],construction,undefined,source);
}

/** Internal accessor: ownership is checked even when no planar cache exists. */
export function planarSourceOfBody3(body:Body3):PreparedPlanarSolid3|undefined{return state(body).planar;}
export function adoptPlanarBody3(source:PreparedPlanarSolid3,construction:BodyConstructionRecord3):Body3 {
  assertOwnedPlanarSolid3(source);const material=planarSolidRegions3(source),domains=source.polygons.map((p,i)=>{const s=source.topology.faces[i]!.surface;if(s.kind!=='plane')throw new Error('Planar Body has curved support');return encodePlanarPolygonDomain3(p,s.plane.normal);});
  return publish(source.topology,createExactPlanarLocator3(source.triangles),domains,material.samples.map(snapshotExactPoint3),construction,{regions:material.regions,planar:source});
}

export function adoptConsolidatedPlanarBody3(input:ConsolidatedPlanarSolid3,construction:BodyConstructionRecord3):Body3 {
  assertOwnedConsolidatedPlanarSolid3(input);const source=input.source,material=planarSolidRegions3(source),regions=material.regions.map(r=>({shells:r.shells.map(id=>input.shellMap[id]!),void:r.void}));
  return publish(input.sewn.topology,createExactPlanarLocator3(source.triangles),input.faces.map(encodePlanarDomain3),material.samples.map(snapshotExactPoint3),construction,{regions,planar:source});
}

/** Internal family dispatch preserves constructive ownership through restoration. */
export function cylinderSourceOfBody3(body:Body3):ClippedCylinderBRep3 {
  const cylinder=state(body).cylinder;if(!cylinder)throw new RangeError('Operation requires a cylinder/halfspace Body construction');return cylinder;
}

/** Native-only operations must check the stored backend, rather than casting a
 * common mixed topology to native edges. */
export function nativeTopologyOfBody3(body:Body3):BRepTopology3 {const t=state(body).nativeTopology;if(!t)throw new RangeError('Operation requires a native-boundary Body; curved Boolean operands are not yet supported');return t;}
export function adoptFiniteCylinderBooleanBody3(source:FiniteCylinderBoolean3):Body3 {
 assertOwnedFiniteCylinderBoolean3(source);const material=finiteCylinderBooleanRegions3(source),restored=finiteCylinderRegionFaces3(material),geometry=restored.boundary.geometry,topology=restored.boundary.topology,faces=restored.faces,samples=Object.freeze(material.materialSamples.map(snapshotExactPoint3)),primitive=(p:FiniteCylinder3)=>({origin:encodeRationalPoint3(p.cylinder.axis.origin),direction:encodeRationalPoint3(p.cylinder.axis.direction),radiusSquared:p.cylinder.radiusSquared.toString(),lower:p.lower.toString(),upper:p.upper.toString()});
 if(!topology.closedOrientedIncidence||topology.issues.length||samples.length!==material.regions.slice(1).filter(r=>!r.void).length||samples.some(p=>source.locate(p)!=='inside'))throw new Error('Curved Body representation invariant failed');
 const document=readBodyDocument3({version:1,construction:{kind:'finite-cylinder-boolean',first:primitive(source.first),second:primitive(source.second),operation:source.operation},body:material.record}),result=Object.freeze({record:geometry.record,geometry,topology,construction:document.construction,interiorSamples:samples,faces});
 states.set(result,{locate:p=>source.locate(p),faces:Object.freeze(faces.map(f=>(p:Point3|AlgebraicCoordinates3)=>f.locate(p))),planar:undefined,cylinder:undefined,nativeTopology:undefined,finiteCylinderBoolean:source});return result;
}

export function finiteCylinderExpressionSourceOfBody3(body:Body3):FiniteCylinderExpressionBoundary3|undefined{return state(body).finiteCylinderExpression;}
export function finiteCylinderBooleanSourceOfBody3(body:Body3):FiniteCylinderBoolean3|undefined{return state(body).finiteCylinderBoolean;}
export function adoptFiniteCylinderExpressionBody3(source:FiniteCylinderExpressionBoundary3):Body3 {
 assertOwnedFiniteCylinderExpressionBoundary3(source);const material=finiteCylinderExpressionRegions3(source),restored=finiteCylinderRegionFaces3(material),geometry=restored.boundary.geometry,topology=restored.boundary.topology,faces=restored.faces,samples=Object.freeze(material.materialSamples.map(snapshotExactPoint3)),locate:Location=p=>locateFiniteCylinderExpression3(source,p),primitive=(p:FiniteCylinder3)=>({origin:encodeRationalPoint3(p.cylinder.axis.origin),direction:encodeRationalPoint3(p.cylinder.axis.direction),radiusSquared:p.cylinder.radiusSquared.toString(),lower:p.lower.toString(),upper:p.upper.toString()});
 if(!topology.closedOrientedIncidence||topology.issues.length||samples.length!==material.regions.slice(1).filter(r=>!r.void).length||samples.some(p=>locate(p)!=='inside'))throw new Error('Cylinder expression Body representation invariant failed');
 const document=readBodyDocument3({version:1,construction:{kind:'finite-cylinder-expression',operands:source.operands.map(primitive),expression:source.expression},body:material.record}),result=Object.freeze({record:geometry.record,geometry,topology,construction:document.construction,interiorSamples:samples,faces});
 states.set(result,{locate,faces:Object.freeze(faces.map(f=>(p:Point3|AlgebraicCoordinates3)=>f.locate(p))),planar:undefined,cylinder:undefined,nativeTopology:undefined,finiteCylinderBoolean:undefined,finiteCylinderExpression:source});return result;
}

/** Adopt only a constructive manifold cut child with derived material regions. */
export function adoptCylinderExpressionSplitBody3(source:CylinderExpressionPlaneSplit3,side:-1|1):Body3 {
 const material=finiteCylinderExpressionSplitRegions3(source,side),restored=finiteCylinderRegionFaces3(material),child=side===-1?source.negative:source.positive,geometry=restored.boundary.geometry,topology=restored.boundary.topology,faces=restored.faces,samples=Object.freeze(material.materialSamples.map(snapshotExactPoint3)),locate:Location=p=>child.locate(p),primitive=(p:FiniteCylinder3)=>({origin:encodeRationalPoint3(p.cylinder.axis.origin),direction:encodeRationalPoint3(p.cylinder.axis.direction),radiusSquared:p.cylinder.radiusSquared.toString(),lower:p.lower.toString(),upper:p.upper.toString()});
 if(!topology.closedOrientedIncidence||topology.issues.length||samples.length!==material.regions.slice(1).filter(r=>!r.void).length||samples.some(p=>locate(p)!=='inside'))throw new Error('Plane-cut cylinder expression Body invariant failed');
 const document=readBodyDocument3({version:1,construction:{kind:'plane-cut-cylinder-expression',operands:source.source.operands.map(primitive),expression:source.source.expression,cut:{normal:encodeRationalPoint3(source.plane.normal),offset:source.plane.offset.toString(),side}},body:material.record}),result=Object.freeze({record:geometry.record,geometry,topology,construction:document.construction,interiorSamples:samples,faces});
 states.set(result,{locate,faces:Object.freeze(faces.map(f=>(p:Point3|AlgebraicCoordinates3)=>f.locate(p))),planar:undefined,cylinder:undefined,nativeTopology:undefined,finiteCylinderBoolean:undefined,planeCutExpression:Object.freeze({source:source.source,cut:Object.freeze({plane:source.plane,side})})});return result;
}

export function clippedCylinderExpressionSourceOfBody3(body:Body3):ClippedCylinderExpression3|undefined{return state(body).clippedExpression;}
export function planeCutCylinderExpressionSourceOfBody3(body:Body3):Readonly<{source:FiniteCylinderExpressionBoundary3;cut:CylinderHalfSpace3}>|undefined{return state(body).planeCutExpression;}
/** Derived regions and independently bound geometry, never caller incidence flags. */
export function adoptClippedCylinderExpressionBody3(source:ClippedCylinderExpression3):Body3 {
 const material=clippedCylinderExpressionRegions3(source),restored=finiteCylinderRegionFaces3(material),geometry=restored.boundary.geometry,topology=restored.boundary.topology,faces=restored.faces,samples=Object.freeze(material.materialSamples.map(snapshotExactPoint3)),locate:Location=p=>source.locate(p),primitive=(p:FiniteCylinder3)=>({origin:encodeRationalPoint3(p.cylinder.axis.origin),direction:encodeRationalPoint3(p.cylinder.axis.direction),radiusSquared:p.cylinder.radiusSquared.toString(),lower:p.lower.toString(),upper:p.upper.toString()});
 if(!topology.closedOrientedIncidence||topology.issues.length||samples.length!==material.regions.slice(1).filter(r=>!r.void).length||samples.some(p=>locate(p)!=='inside'))throw new Error('Clipped cylinder expression Body invariant failed');
 const document=readBodyDocument3({version:1,construction:{kind:'clipped-cylinder-expression',operands:source.source.operands.map(primitive),expression:source.source.expression,halfspaces:source.halfspaces.map(h=>({normal:encodeRationalPoint3(h.plane.normal),offset:h.plane.offset.toString(),side:h.side}))},body:material.record}),result=Object.freeze({record:geometry.record,geometry,topology,construction:document.construction,interiorSamples:samples,faces});
 states.set(result,{locate,faces:Object.freeze(faces.map(f=>(p:Point3|AlgebraicCoordinates3)=>f.locate(p))),planar:undefined,cylinder:undefined,nativeTopology:undefined,finiteCylinderBoolean:undefined,clippedExpression:source});return result;
}

export function cylinderMaterialSourceOfBody3(body:Body3):CylinderMaterialBoundary3|undefined{return state(body).material;}
/** Only a bounded constructive, manifold material result can acquire Body ownership. */
export function adoptCylinderMaterialBody3(source:CylinderMaterialBoundary3):Body3 {
 const material=cylinderMaterialRegions3(source),restored=finiteCylinderRegionFaces3(material),geometry=restored.boundary.geometry,topology=restored.boundary.topology,faces=restored.faces,samples=Object.freeze(material.materialSamples.map(snapshotExactPoint3)),locate:Location=p=>source.locate(p),primitive=(p:FiniteCylinder3)=>({origin:encodeRationalPoint3(p.cylinder.axis.origin),direction:encodeRationalPoint3(p.cylinder.axis.direction),radiusSquared:p.cylinder.radiusSquared.toString(),lower:p.lower.toString(),upper:p.upper.toString()});
 if(!topology.closedOrientedIncidence||topology.issues.length||samples.length!==material.regions.slice(1).filter(r=>!r.void).length||samples.some(p=>locate(p)!=='inside'))throw new Error('Cylinder material Body invariant failed');
 const document=readBodyDocument3({version:1,construction:{kind:'cylinder-material-expression',cylinders:source.cylinders.map(primitive),planes:source.planes.map(p=>({normal:encodeRationalPoint3(p.normal),offset:p.offset.toString()})),expression:source.expression},body:material.record}),result=Object.freeze({record:geometry.record,geometry,topology,construction:document.construction,interiorSamples:samples,faces});states.set(result,{locate,faces:Object.freeze(faces.map(f=>(p:Point3|AlgebraicCoordinates3)=>f.locate(p))),planar:undefined,cylinder:undefined,nativeTopology:undefined,finiteCylinderBoolean:undefined,material:source});return result;
}

export function materialSurfaceSourceOfBody3(body:Body3):MaterialSurfaceBoundary3|undefined {return state(body).materialSurface;}
/** Adopt only a constructive manifold after exact domain and region analysis. */
export function adoptMaterialSurfaceBody3(source:MaterialSurfaceBoundary3):Body3 {
 const material=materialSurfaceRegions3(source),restored=finiteCylinderRegionFaces3(material),geometry=restored.boundary.geometry,topology=restored.boundary.topology,faces=restored.faces;
 const program=resolveCylinderMaterialProgram3(source.material),samples=Object.freeze(material.materialSamples.map(snapshotExactPoint3)),locate:Location=p=>locateMaterialSurfaceBoundary3(source,p);
 if(!topology.closedOrientedIncidence||topology.issues.length||samples.length!==material.regions.slice(1).filter(r=>!r.void).length||samples.some(p=>locate(p)!=='inside'))throw new Error('Material surface Body invariant failed');
 const primitive=(p:FiniteCylinder3)=>({origin:encodeRationalPoint3(p.cylinder.axis.origin),direction:encodeRationalPoint3(p.cylinder.axis.direction),radiusSquared:p.cylinder.radiusSquared.toString(),lower:p.lower.toString(),upper:p.upper.toString()});
 const document=readBodyDocument3({version:1,construction:{kind:'surface-material-expression',cylinders:program.cylinders.map(primitive),planes:program.planes.map(p=>({normal:encodeRationalPoint3(p.normal),offset:p.offset.toString()})),expression:program.expression},body:material.record});
 const result=Object.freeze({record:geometry.record,geometry,topology,construction:document.construction,interiorSamples:samples,faces});
 states.set(result,{locate,faces:Object.freeze(faces.map(f=>(p:Point3|AlgebraicCoordinates3)=>f.locate(p))),planar:undefined,cylinder:undefined,nativeTopology:undefined,finiteCylinderBoolean:undefined,materialSurface:source});return result;
}
