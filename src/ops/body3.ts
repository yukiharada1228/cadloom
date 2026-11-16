import {booleanCylinderMaterialPrograms3,clipCylinderMaterialProgram3} from '../geometry/cylinder-material-program3.js';
import type {CylinderMaterialProgram3} from '../geometry/cylinder-material-program3.js';
import {materialSurfaceSourceOfBody3} from '../model/body3.js';
import {resolveCylinderMaterialProgram3,materialProgramFromOperand3} from '../geometry/cylinder-material-expression3.js';
import {prepareCylinderMaterialProgram3} from '../geometry/cylinder-material-program3.js';
import {boundaryMaterialSurfaces3} from '../geometry/material-surface-boundary3.js';
import type {MaterialSurfaceBoundary3} from '../geometry/material-surface-boundary3.js';
import {adoptMaterialSurfaceBody3} from '../model/body3.js';
import {preparePlanarMaterialProgram3,boundaryPlanarMaterial3} from '../geometry/planar-material-boundary3.js';
import {prepareExtrudeMaterialProgram3,boundaryCircularExtrudeMaterial3} from '../convert/circular-extrude-material3.js';
import {prepareBoxMaterialProgram3,boundaryBoxMaterial3} from '../geometry/box-material3.js';
import {boundaryCylinderMaterialExpression3,booleanCylinderMaterials3,clipCylinderMaterial3} from '../geometry/cylinder-material-expression3.js';
import type {CylinderMaterialBoundary3,CylinderMaterialOperand3} from '../geometry/cylinder-material-expression3.js';
import {adoptCylinderMaterialBody3,cylinderMaterialSourceOfBody3} from '../model/body3.js';
import {clipFiniteCylinderExpression3,refineClippedCylinderExpression3} from '../geometry/clipped-cylinder-expression3.js';
import type {ClippedCylinderExpression3} from '../geometry/clipped-cylinder-expression3.js';
import {adoptClippedCylinderExpressionBody3,clippedCylinderExpressionSourceOfBody3,planeCutCylinderExpressionSourceOfBody3} from '../model/body3.js';
import {splitFiniteCylinderExpressionByPlane3} from '../geometry/cylinder-expression-plane-split3.js';
import type {CylinderExpressionPlaneSplit3} from '../geometry/cylinder-expression-plane-split3.js';
import {adoptCylinderExpressionSplitBody3} from '../model/body3.js';
import {boundaryFiniteCylinderExpression3} from '../geometry/finite-cylinder-expression3.js';
import type {FiniteCylinderExpressionBoundary3,FiniteCylinderExpression3} from '../geometry/finite-cylinder-expression3.js';
import type {FiniteCylinder3} from '../geometry/finite-cylinder-boolean3.js';
import {adoptFiniteCylinderExpressionBody3,finiteCylinderExpressionSourceOfBody3,finiteCylinderBooleanSourceOfBody3} from '../model/body3.js';
import {prepareFiniteCylinder3,booleanFiniteCylinders3} from '../geometry/finite-cylinder-boolean3.js';
import type {FiniteCylinderBoolean3} from '../geometry/finite-cylinder-boolean3.js';
import {adoptFiniteCylinderBooleanBody3,nativeTopologyOfBody3,cylinderSourceOfBody3} from '../model/body3.js';
import {plane3} from '../geometry/plane3.js';
import type {CylinderHalfSpace3} from '../geometry/trimmed-cylinder3.js';
import type {ClippedCylinderBRep3} from '../geometry/clipped-cylinder-brep3.js';
import type {PreparedPlanarSolid3} from '../geometry/planar-solid3.js';
import {consolidatePlanarSolid3} from '../geometry/consolidate-planar-solid3.js';
import {planarSolidWithFaceOrigins3} from '../convert/planar-body3.js';
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
import {adoptExtrudedBody3,adoptCylinderBody3,assertOwnedBody3,adoptPlanarBody3,planarSourceOfBody3,adoptConsolidatedPlanarBody3} from '../model/body3.js';
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
    case 'surface-material-expression':{const cylinders=construction.cylinders.map(p=>prepareFiniteCylinder3(cylinder3(line3(decodeRationalPoint3(p.origin),decodeRationalPoint3(p.direction)),p.radiusSquared),p.lower,p.upper));return bodyFromMaterialSurfaceBoundary3(boundaryMaterialSurfaces3(prepareCylinderMaterialProgram3(cylinders,construction.planes.map(p=>plane3(p.normal[0],p.normal[1],p.normal[2],p.offset)),construction.expression),{requireClosed:true}));}
    case 'cylinder-material-expression':{const cylinders=construction.cylinders.map(p=>prepareFiniteCylinder3(cylinder3(line3(decodeRationalPoint3(p.origin),decodeRationalPoint3(p.direction)),p.radiusSquared),p.lower,p.upper));return bodyFromCylinderMaterial3(boundaryCylinderMaterialExpression3(cylinders,construction.planes.map(p=>plane3(p.normal[0],p.normal[1],p.normal[2],p.offset)),construction.expression));}
    case 'clipped-cylinder-expression':{const operands=construction.operands.map(p=>prepareFiniteCylinder3(cylinder3(line3(decodeRationalPoint3(p.origin),decodeRationalPoint3(p.direction)),p.radiusSquared),p.lower,p.upper)),source=boundaryFiniteCylinderExpression3(operands,construction.expression);return bodyFromClippedCylinderExpression3(clipFiniteCylinderExpression3(source,construction.halfspaces.map(h=>({plane:plane3(h.normal[0],h.normal[1],h.normal[2],h.offset),side:h.side}))));}
    case 'plane-cut-cylinder-expression':{const operands=construction.operands.map(p=>prepareFiniteCylinder3(cylinder3(line3(decodeRationalPoint3(p.origin),decodeRationalPoint3(p.direction)),p.radiusSquared),p.lower,p.upper)),source=boundaryFiniteCylinderExpression3(operands,construction.expression),cut=construction.cut,split=splitFiniteCylinderExpressionByPlane3(source,plane3(cut.normal[0],cut.normal[1],cut.normal[2],cut.offset));return bodyFromCylinderExpressionSplit3(split,cut.side);}
    case 'finite-cylinder-expression':{const operands=construction.operands.map(p=>prepareFiniteCylinder3(cylinder3(line3(decodeRationalPoint3(p.origin),decodeRationalPoint3(p.direction)),p.radiusSquared),p.lower,p.upper));return bodyFromFiniteCylinderExpression3(boundaryFiniteCylinderExpression3(operands,construction.expression));}
    case 'finite-cylinder-boolean':{const cylinder=(p:typeof construction.first)=>prepareFiniteCylinder3(cylinder3(line3(decodeRationalPoint3(p.origin),decodeRationalPoint3(p.direction)),p.radiusSquared),p.lower,p.upper);return bodyFromFiniteCylinderBoolean3(booleanFiniteCylinders3(cylinder(construction.first),cylinder(construction.second),construction.operation));}
    case 'planar-consolidated':return replayConsolidated(construction.polygons.map(p=>p.map(decodeRationalPoint3))).body;
    case 'planar':return createPlanarBody3(construction.polygons.map(p=>p.map(decodeRationalPoint3)));
    case 'box':{const s=construction.size;return createBoxBody3(decodeRationalPoint3(construction.origin),s[0],s[1],s[2]);}
    case 'clipped-cylinder':return createClippedCylinderBody3(cylinder3(line3(decodeRationalPoint3(construction.origin),decodeRationalPoint3(construction.direction)),construction.radiusSquared),construction.lower,construction.upper,construction.halfspaces.map(h=>({plane:plane3(h.normal[0],h.normal[1],h.normal[2],h.offset),side:h.side})));
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
  const first=planarSourceOfBody3(a)??planarSolidFromBoundary3(nativeTopologyOfBody3(a)),second=planarSourceOfBody3(b)??planarSolidFromBoundary3(nativeTopologyOfBody3(b)),result=booleanPlanarSolids3(first,second,operation);
  if(!result.topology.closedOrientedIncidence||result.topology.issues.length)throw new RangeError('Common Body does not yet support nonmanifold contact results; use booleanPlanarSolids3 to retain this material');
  return createPlanarBody3(result.polygons);
}

export interface ConsolidatedPlanarBody3 {
  readonly body:Body3;
  /** Output face → immediate input Body face IDs. Not persistent feature history. */
  readonly sourceFaces:readonly (readonly number[])[];
  /** Immediate input Body face IDs whose pinched union was kept as valid patches. */
  readonly retainedFaces:readonly number[];
}
function consolidatedBody(source:PreparedPlanarSolid3){
  const merged=consolidatePlanarSolid3(source),body=adoptConsolidatedPlanarBody3(merged,{kind:'planar-consolidated',polygons:merged.source.polygons.map(p=>p.map(encodeRationalPoint3))});
  return {merged,body};
}
function replayConsolidated(polygons:readonly (readonly Point3[])[]){return consolidatedBody(preparePlanarSolid3(polygons));}
/** Merge connected coplanar cooriented rational planar faces, preserving holes,
 * material, shell roles and immediate input-face correspondence.
 */
export function consolidatePlanarBody3(input:Body3):ConsolidatedPlanarBody3 {
  assertOwnedBody3(input);const converted=planarSolidWithFaceOrigins3(nativeTopologyOfBody3(input)),{merged,body}=consolidatedBody(converted.solid),unique=(ids:readonly number[])=>Object.freeze([...new Set(ids.map(id=>converted.faceOrigins[id]!))].sort((a,b)=>a-b));
  return Object.freeze({body,sourceFaces:Object.freeze(merged.sourceFaces.map(unique)),retainedFaces:unique(merged.retainedFaces)});
}

/** Finite circular cylinder intersected with rational plane halfspaces. */
export function createClippedCylinderBody3(cylinder:Cylinder3,lower:ExactInput,upper:ExactInput,halfspaces:readonly CylinderHalfSpace3[]=[]):Body3 {
  return bodyFromClippedCylinder3(clipCylinderBRep3(cylinder,lower,upper,halfspaces));
}
/** Internal conversion of owned geometry. All normalized inequalities, including
 * inactive or infeasibility-producing constraints, are persisted for replay.
 */
export function bodyFromClippedCylinder3(source:ClippedCylinderBRep3):Body3 {
  const c=source.cylinder;
  return adoptCylinderBody3(source,{kind:'clipped-cylinder',origin:encodeRationalPoint3(c.axis.origin),direction:encodeRationalPoint3(c.axis.direction),radiusSquared:c.radiusSquared.toString(),lower:source.lower.toString(),upper:source.upper.toString(),halfspaces:source.planes.map(p=>({normal:encodeRationalPoint3(p.normal),offset:p.offset.toString(),side:-1}))});
}

/** Adopt an owned manifold two-cylinder Boolean into the common Body contract. */
export function bodyFromFiniteCylinderBoolean3(source:FiniteCylinderBoolean3):Body3 {return adoptFiniteCylinderBooleanBody3(source);}
/** Cylinder-family Booleans retain operand-local planes on previously cut Bodies. */
export function booleanCylinderBodies3(first:Body3,second:Body3,operation:BooleanOperation):Body3 {
 assertOwnedBody3(first);assertOwnedBody3(second);if(first.construction.kind==='box'||second.construction.kind==='box'||planarSourceOfBody3(first)||planarSourceOfBody3(second))throw new RangeError('Cylinder Body Boolean requires cylinder/halfspace operands; use booleanMixedBodies3 for planar operands');if(!['union','intersection','difference','xor'].includes(operation))throw new RangeError('Unknown cylinder Body operation');if(materialSurfaceSourceOfBody3(first)||materialSurfaceSourceOfBody3(second))return booleanSurfaceBodies3(first,second,operation);const mixed=(b:Body3)=>['clipped-cylinder','plane-cut-cylinder-expression','clipped-cylinder-expression','cylinder-material-expression'].includes(b.construction.kind);if(mixed(first)||mixed(second))return bodyFromCylinderMaterial3(booleanCylinderMaterials3(materialOperandOfBody3(first),materialOperandOfBody3(second),operation));
 const primitive=(body:Body3)=>{const s=cylinderSourceOfBody3(body);if(s.planes.length!==2)throw new RangeError('Cylinder Body Boolean requires an unclipped finite cylinder');return prepareFiniteCylinder3(s.cylinder,s.lower,s.upper);};
 const parts=(body:Body3):{operands:readonly FiniteCylinder3[];expression:FiniteCylinderExpression3}|null=>{const expression=finiteCylinderExpressionSourceOfBody3(body);if(expression)return expression;const binary=finiteCylinderBooleanSourceOfBody3(body);return binary?{operands:[binary.first,binary.second],expression:{kind:binary.operation,first:{kind:'operand',operand:0},second:{kind:'operand',operand:1}}}:null;},a=parts(first),b=parts(second);
 if(!a&&!b)return bodyFromFiniteCylinderBoolean3(booleanFiniteCylinders3(primitive(first),primitive(second),operation));
 const operands:FiniteCylinder3[]=[],ids=new Map<FiniteCylinder3,number>();
 const remap=(part:{operands:readonly FiniteCylinder3[];expression:FiniteCylinderExpression3}):FiniteCylinderExpression3=>{const indices=part.operands.map(p=>{let id=ids.get(p);if(id===undefined){id=operands.length;ids.set(p,id);operands.push(p);}return id;}),walk=(t:FiniteCylinderExpression3):FiniteCylinderExpression3=>t.kind==='operand'?{kind:'operand',operand:indices[t.operand]!}:{kind:t.kind,first:walk(t.first),second:walk(t.second)};return walk(part.expression);},leaf=(body:Body3)=>({operands:[primitive(body)],expression:{kind:'operand' as const,operand:0}});
 const expression:FiniteCylinderExpression3={kind:operation,first:remap(a??leaf(first)),second:remap(b??leaf(second))};return bodyFromFiniteCylinderExpression3(boundaryFiniteCylinderExpression3(operands,expression));
}
export function bodyFromFiniteCylinderExpression3(source:FiniteCylinderExpressionBoundary3):Body3 {return adoptFiniteCylinderExpressionBody3(source);}

/** Common Body with derived regions and replay-checked single-cut construction. */
export function bodyFromCylinderExpressionSplit3(source:CylinderExpressionPlaneSplit3,side:-1|1):Body3 {return adoptCylinderExpressionSplitBody3(source,side);}

export function bodyFromClippedCylinderExpression3(source:ClippedCylinderExpression3):Body3 {return adoptClippedCylinderExpressionBody3(source);}
/** Append halfspaces to owned cylinder-family Bodies, including restored previous
 * cut and mixed-predicate Boolean results, retaining each local formula. */
export function clipCylinderExpressionBody3(body:Body3,halfspaces:readonly CylinderHalfSpace3[]):Body3 {
 assertOwnedBody3(body);const surface=materialSurfaceSourceOfBody3(body);if(surface)return bodyFromMaterialSurfaceBoundary3(boundaryMaterialSurfaces3(clipCylinderMaterialProgram3(resolveCylinderMaterialProgram3(surface.material),halfspaces),{requireClosed:true}));const material=cylinderMaterialSourceOfBody3(body);if(material)return bodyFromCylinderMaterial3(clipCylinderMaterial3(material,halfspaces));const clipped=clippedCylinderExpressionSourceOfBody3(body);if(clipped)return bodyFromClippedCylinderExpression3(refineClippedCylinderExpression3(clipped,halfspaces));const cut=planeCutCylinderExpressionSourceOfBody3(body);if(cut)return bodyFromClippedCylinderExpression3(clipFiniteCylinderExpression3(cut.source,[cut.cut,...halfspaces]));
 let source=finiteCylinderExpressionSourceOfBody3(body);const binary=finiteCylinderBooleanSourceOfBody3(body);if(!source&&binary)source=boundaryFiniteCylinderExpression3([binary.first,binary.second],{kind:binary.operation,first:{kind:'operand',operand:0},second:{kind:'operand',operand:1}});
 if(source)return bodyFromClippedCylinderExpression3(clipFiniteCylinderExpression3(source,halfspaces));const primitive=cylinderSourceOfBody3(body),base=prepareFiniteCylinder3(primitive.cylinder,primitive.lower,primitive.upper),expression=boundaryFiniteCylinderExpression3([base],{kind:'operand',operand:0});return bodyFromClippedCylinderExpression3(clipFiniteCylinderExpression3(expression,[...primitive.planes.map(plane=>({plane,side:-1 as const})),...halfspaces]));
}

export function bodyFromCylinderMaterial3(source:CylinderMaterialBoundary3):Body3 {return adoptCylinderMaterialBody3(source);}
/** Selection only inspects owned backend provenance and actual support types;
 * the planar converter still validates straight edges and rational geometry. */
function nativePlanarOperand3(body:Body3):boolean {
 return !!planarSourceOfBody3(body)||body.construction.kind==='extrude'&&body.topology.faces.every(f=>f.surface.kind==='plane');
}
/** Boolean composition for owned planar, box and cylinder-family Bodies.
 * Planar pairs use the native planar kernel; other supported pairs use the mixed
 * material recipe. Both paths require manifold material and support replay. */
export function booleanMixedBodies3(first:Body3,second:Body3,operation:BooleanOperation):Body3 {
 assertOwnedBody3(first);assertOwnedBody3(second);
 if(!['union','intersection','difference','xor'].includes(operation))throw new RangeError('Unknown mixed Body operation');
 if(materialSurfaceSourceOfBody3(first)||materialSurfaceSourceOfBody3(second))return booleanSurfaceBodies3(first,second,operation);
 if(nativePlanarOperand3(first)&&nativePlanarOperand3(second))return booleanPlanarBodies3(first,second,operation);
 return bodyFromCylinderMaterial3(booleanCylinderMaterials3(materialOperandOfBody3(first),materialOperandOfBody3(second),operation));
}
/** Source conversion is restricted to actual owned planar/box/cylinder backends. */
function materialOperandOfBody3(body:Body3):CylinderMaterialOperand3 {
 assertOwnedBody3(body);
 if(nativePlanarOperand3(body))return boundaryPlanarMaterial3(planarSourceOfBody3(body)??planarSolidFromBoundary3(body.topology));
 if(body.construction.kind==='extrude')return boundaryCircularExtrudeMaterial3(body);
 if(body.construction.kind==='box'){const c=body.construction;return boundaryBoxMaterial3(decodeRationalPoint3(c.origin),c.size[0],c.size[1],c.size[2]);}
 const material=cylinderMaterialSourceOfBody3(body);if(material)return material;const clipped=clippedCylinderExpressionSourceOfBody3(body);if(clipped)return clipped;const cut=planeCutCylinderExpressionSourceOfBody3(body);if(cut)return clipFiniteCylinderExpression3(cut.source,[cut.cut]);let source=finiteCylinderExpressionSourceOfBody3(body);const binary=finiteCylinderBooleanSourceOfBody3(body);if(!source&&binary)source=boundaryFiniteCylinderExpression3([binary.first,binary.second],{kind:binary.operation,first:{kind:'operand',operand:0},second:{kind:'operand',operand:1}});if(source)return clipFiniteCylinderExpression3(source,[]);const c=cylinderSourceOfBody3(body),base=prepareFiniteCylinder3(c.cylinder,c.lower,c.upper);if(body.construction.kind==='cylinder')return boundaryCylinderMaterialExpression3([base],[],{kind:'cylinder',cylinder:0});return clipFiniteCylinderExpression3(boundaryFiniteCylinderExpression3([base],{kind:'operand',operand:0}),c.planes.map(plane=>({plane,side:-1 as const})));
}

export function bodyFromMaterialSurfaceBoundary3(source:MaterialSurfaceBoundary3):Body3 {return adoptMaterialSurfaceBody3(source);}

function programOfBody3(body:Body3):CylinderMaterialProgram3 {
 if(nativePlanarOperand3(body))return preparePlanarMaterialProgram3(planarSourceOfBody3(body)??planarSolidFromBoundary3(body.topology));
 const surface=materialSurfaceSourceOfBody3(body);if(surface)return resolveCylinderMaterialProgram3(surface.material);
 if(body.construction.kind==='extrude')return prepareExtrudeMaterialProgram3(body);
 if(body.construction.kind==='box'){
  const c=body.construction;return prepareBoxMaterialProgram3(decodeRationalPoint3(c.origin),c.size[0],c.size[1],c.size[2]);
 }
 if(body.construction.kind==='cylinder'||body.construction.kind==='clipped-cylinder'){
  const c=cylinderSourceOfBody3(body),base=prepareCylinderMaterialProgram3([prepareFiniteCylinder3(c.cylinder,c.lower,c.upper)],[],{kind:'cylinder',cylinder:0});
  return body.construction.kind==='cylinder'?base:clipCylinderMaterialProgram3(base,c.planes.map(plane=>({plane,side:-1 as const})));
 }
 return materialProgramFromOperand3(materialOperandOfBody3(body));
}
function booleanSurfaceBodies3(first:Body3,second:Body3,operation:BooleanOperation):Body3 {
 const program=booleanCylinderMaterialPrograms3(programOfBody3(first),programOfBody3(second),operation);
 return bodyFromMaterialSurfaceBoundary3(boundaryMaterialSurfaces3(program,{requireClosed:true}));
}

/** Explicit common definition-driven kernel path, including pairs of legacy Bodies. */
export function booleanMaterialBodies3(first:Body3,second:Body3,operation:BooleanOperation):Body3 {
 assertOwnedBody3(first);assertOwnedBody3(second);
 if(!['union','intersection','difference','xor'].includes(operation))throw new RangeError('Unknown material Body operation');
 return booleanSurfaceBodies3(first,second,operation);
}
