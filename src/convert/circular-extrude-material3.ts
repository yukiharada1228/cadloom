import {prepareCylinderMaterialProgram3,booleanCylinderMaterialPrograms3} from '../geometry/cylinder-material-program3.js';
import type {CylinderMaterialProgram3} from '../geometry/cylinder-material-program3.js';
import {point2} from '../geometry/point2.js';
import {extrudePolygon} from '../geometry/extrude.js';
import {triangle3} from '../geometry/triangle3.js';
import {preparePlanarSolid3} from '../geometry/planar-solid3.js';
import {preparePlanarMaterialProgram3} from '../geometry/planar-material-boundary3.js';
import type {CurveRegion2} from '../geometry/curve-boolean2.js';
import type {Rational} from '../numeric/rational.js';
import {assertOwnedBody3,extrusionSourceOfBody3} from '../model/body3.js';
import type {Body3} from '../model/body3.js';
import {fullCircleArc2} from '../geometry/circular-arc2.js';
import {booleanCurveRegions2} from '../geometry/curve-boolean2.js';
import {point3} from '../geometry/point3.js';
import {line3,cylinder3} from '../geometry/surface3.js';
import {prepareFiniteCylinder3} from '../geometry/finite-cylinder-boolean3.js';
import {boundaryCylinderMaterialExpression3} from '../geometry/cylinder-material-expression3.js';
import type {CylinderMaterialBoundary3,CylinderMaterialExpression3} from '../geometry/cylinder-material-expression3.js';

/** Internal lowering of actual normalized circular product boundaries. Geometry
 * comes from the retained owned extrusion, not the caller-visible recipe fields.
 * Each loop must have one circle support and exactly cover its disk under parity.
 * Normalized material boundaries then compose by parity, including holes/islands. */
export function prepareCircularExtrudeMaterialProgram3(body:Body3):CylinderMaterialProgram3 {
 assertOwnedBody3(body);const source=extrusionSourceOfBody3(body);
 if(!source||body.construction.kind!=='extrude')throw new RangeError('Circular Extrude lowering requires an owned product Extrude Body');
 const unsupported=()=>new RangeError('Mixed Body Boolean circular Extrude lowering requires full circular boundary loops');
 if(!source.region.rings.length)throw unsupported();
 const cylinders=source.region.rings.map(ring=>circularRingCylinder(ring,source.zMin,source.zMax));
 let level:CylinderMaterialExpression3[]=cylinders.map((_,cylinder)=>Object.freeze({kind:'cylinder',cylinder}));
 while(level.length>1){const next:CylinderMaterialExpression3[]=[];for(let i=0;i<level.length;i+=2)next.push(i+1<level.length?Object.freeze({kind:'xor',first:level[i]!,second:level[i+1]!}):level[i]!);level=next;}
 return prepareCylinderMaterialProgram3(cylinders,[],level[0]!);
}

function circularRingCylinder(ring:CurveRegion2[number],lower:Rational,upper:Rational){
 const unsupported=()=>new RangeError('Mixed Body Boolean circular Extrude lowering requires full circular boundary loops');
  const first=ring[0];if(!first||first.kind!=='arc'||first.arc.circle.radiusSquared.sign()<=0)throw unsupported();
  const circle=first.arc.circle;
  if(ring.some(c=>c.kind!=='arc'||!c.arc.circle.center.x.equals(circle.center.x)||!c.arc.circle.center.y.equals(circle.center.y)||!c.arc.circle.radiusSquared.equals(circle.radiusSquared)))throw unsupported();
  const full=Object.freeze({kind:'arc' as const,arc:fullCircleArc2(circle)}),difference=booleanCurveRegions2([ring],[[full]],'xor','even-odd');
  if(difference.selectedFaces.length||difference.rings.length)throw unsupported();
  return prepareFiniteCylinder3(cylinder3(line3(point3(circle.center.x,circle.center.y,0n),point3(0n,0n,1n)),circle.radiusSquared),lower,upper);

}
export function boundaryCircularExtrudeMaterial3(body:Body3):CylinderMaterialBoundary3 {
 const p=prepareCircularExtrudeMaterialProgram3(body);return boundaryCylinderMaterialExpression3(p.cylinders,p.planes,p.expression);
}
/** Exact normalized polygon/full-circle product loops; no arc tessellation. */
export function prepareExtrudeMaterialProgram3(body:Body3):CylinderMaterialProgram3 {
 assertOwnedBody3(body);const source=extrusionSourceOfBody3(body);
 if(!source||body.construction.kind!=='extrude')throw new RangeError('Expected an owned product Extrude Body');
 if(!source.region.rings.length)throw new RangeError('Empty Extrude profile is unsupported');
 const programs=source.region.rings.map(ring=>{
  if(ring.every(c=>c.kind==='arc'))return prepareCylinderMaterialProgram3([circularRingCylinder(ring,source.zMin,source.zMax)],[],{kind:'cylinder',cylinder:0});
  if(ring.some(c=>c.kind==='arc'))throw new RangeError('Extrude material lowering requires separate polygon or full circular boundary loops');
  const polygon=ring.map(c=>{
   if(c.kind==='arc')throw new RangeError('Mixed arc-line loops are unsupported');
   if(c.kind==='segment')return point2(c.segment.start.x,c.segment.start.y);
   if(c.interval.start.x.rational===null||c.interval.start.y.rational===null)throw new RangeError('Polygon Extrude lowering requires rational vertices');
   return point2(c.interval.start.x.rational,c.interval.start.y.rational);
  });
  const mesh=extrudePolygon([polygon],source.zMax.sub(source.zMin),{baseZ:source.zMin});
  return preparePlanarMaterialProgram3(preparePlanarSolid3(mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!))));
 });
 let level=programs;
 while(level.length>1){const next:CylinderMaterialProgram3[]=[];for(let i=0;i<level.length;i+=2)next.push(i+1<level.length?booleanCylinderMaterialPrograms3(level[i]!,level[i+1]!,'xor'):level[i]!);level=next;}
 return level[0]!;
}
