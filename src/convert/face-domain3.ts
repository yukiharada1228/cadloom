import {readFaceDomainRecord3} from '../record/face-domain3.js';
import type {FaceDomainRecord3,PlanarDomainRecord3,CylinderDomainRecord3,CircleSupportRecord3,EllipseSupportRecord3,HalfSpaceRecord3} from '../record/face-domain3.js';
import type {FrameRecord3} from '../record/geometry3.js';
import {encodeRationalPoint3,decodeRationalPoint3,encodeExactReal3,decodeExactReal3,encodeExactPoint3,decodeExactPoint3} from './exact3.js';
import {encodeCurveRecord3,decodeCurveRecord3} from './geometry3.js';
import {encodeBodyProfile3,decodeBodyProfile3} from './body-profile3.js';
import {planeFrame3,reverseCurve3} from '../geometry/curve3.js';
import type {PlaneFrame3,Curve3} from '../geometry/curve3.js';
import {circle3} from '../geometry/circle3.js';
import type {Circle3} from '../geometry/circle3.js';
import {ellipse3} from '../geometry/ellipse3.js';
import type {Ellipse3} from '../geometry/ellipse3.js';
import {preparePlanarFace3,prepareRectangleFace3,prepareCircularFace3,prepareEllipseFace3} from '../geometry/planar-face3.js';
import type {PreparedPlanarFace3} from '../geometry/planar-face3.js';
import {prepareCylinderFace3} from '../geometry/cylinder-face3.js';
import type {PreparedCylinderFace3} from '../geometry/cylinder-face3.js';
import {prepareTrimmedPlanar3} from '../geometry/trimmed-planar3.js';
import type {PreparedTrimmedPlanar3,PlanarHalfSpace3} from '../geometry/trimmed-planar3.js';
import {prepareTrimmedCylinder3} from '../geometry/trimmed-cylinder3.js';
import type {PreparedTrimmedCylinder3} from '../geometry/trimmed-cylinder3.js';
import {plane3} from '../geometry/plane3.js';
import {line3,cylinder3} from '../geometry/surface3.js';
import type {Surface3} from '../geometry/surface3.js';
import type {AlgebraicCoordinates3} from '../geometry/algebraic-point3.js';
import type {Point3} from '../geometry/point3.js';
import type {CurveRegionLocation2} from '../geometry/curve-boolean2.js';

const frame=(f:PlaneFrame3):FrameRecord3=>Object.freeze({origin:encodeRationalPoint3(f.origin),u:encodeRationalPoint3(f.u),v:encodeRationalPoint3(f.v)}),unframe=(f:FrameRecord3)=>planeFrame3(decodeRationalPoint3(f.origin),decodeRationalPoint3(f.u),decodeRationalPoint3(f.v));
const circle=(c:Circle3):CircleSupportRecord3=>Object.freeze({center:encodeRationalPoint3(c.center),normal:encodeRationalPoint3(c.normal),radiusSquared:c.radiusSquared.toString()}),uncircle=(c:CircleSupportRecord3)=>circle3(decodeRationalPoint3(c.center),decodeRationalPoint3(c.normal),c.radiusSquared);
const ellipse=(e:Ellipse3):EllipseSupportRecord3=>Object.freeze({frame:frame(e.frame),radiusUSquared:e.radiusUSquared.toString(),radiusVSquared:e.radiusVSquared.toString()}),unellipse=(e:EllipseSupportRecord3)=>ellipse3(unframe(e.frame),e.radiusUSquared,e.radiusVSquared);
function planes(h:readonly PlanarHalfSpace3[]):readonly HalfSpaceRecord3[]{return Object.freeze(h.map(p=>Object.freeze({normal:encodeRationalPoint3(p.plane.normal),offset:p.plane.offset.toString(),side:p.side})));}
function unplanes(h:readonly HalfSpaceRecord3[]):readonly PlanarHalfSpace3[]{return Object.freeze(h.map(p=>({plane:plane3(p.normal[0],p.normal[1],p.normal[2],p.offset),side:p.side})));}
export function encodePlanarDomain3(face:PreparedPlanarFace3):PlanarDomainRecord3 {
  const d=face.domain,sense=face.sense;
  switch(d.kind){
    case 'chart':{
      const canonical=encodeBodyProfile3(d.region.rings),rings=sense===1?canonical:Object.freeze(canonical.map(r=>Object.freeze(r.slice().reverse().map(record=>{const c=decodeCurveRecord3(record);if(c.kind==='nurbs')throw new Error('Unexpected canonical profile curve');return encodeCurveRecord3(reverseCurve3(c));}))));
      return Object.freeze({kind:'chart',frame:frame(d.frame),rings,sense});
    }
    case 'rectangle':return Object.freeze({kind:'rectangle',frame:frame(d.frame),uMin:encodeExactReal3(d.uMin),uMax:encodeExactReal3(d.uMax),vMin:encodeExactReal3(d.vMin),vMax:encodeExactReal3(d.vMax),sense});
    case 'circular':return Object.freeze({kind:'circular',outer:circle(d.outer),holes:Object.freeze(d.holes.map(circle)),sense});
    case 'elliptic':return Object.freeze({kind:'elliptic',ellipse:ellipse(d.ellipse),sense});
  }
}
export function encodeCylinderDomain3(face:PreparedCylinderFace3):CylinderDomainRecord3 {return Object.freeze({kind:'cylinder-product',origin:encodeRationalPoint3(face.surface.axis.origin),direction:encodeRationalPoint3(face.surface.axis.direction),radiusSquared:face.surface.radiusSquared.toString(),lower:face.lower.toString(),upper:face.upper.toString(),angular:encodeCurveRecord3({kind:'circular-arc',arc:face.angular}),sense:face.sense});}
export function encodeTrimmedPlanarDomain3(face:PreparedTrimmedPlanar3,component:number):FaceDomainRecord3 {
  if(!Number.isSafeInteger(component)||component<0||component>=face.components.length)throw new RangeError('Invalid planar component');return Object.freeze({kind:'trimmed-planar',base:encodePlanarDomain3(face.base),halfspaces:planes(face.halfspaces),sample:encodeExactPoint3(face.components[component]!.sample)});
}
export function encodeTrimmedCylinderDomain3(face:PreparedTrimmedCylinder3,component:number):FaceDomainRecord3 {
  if(!Number.isSafeInteger(component)||component<0||component>=face.components.length)throw new RangeError('Invalid cylinder component');return Object.freeze({kind:'trimmed-cylinder',base:encodeCylinderDomain3(face.base),halfspaces:planes(face.halfspaces),sample:encodeExactPoint3(face.components[component]!.sample)});
}
export function decodePlanarDomain3(d:PlanarDomainRecord3):PreparedPlanarFace3 {
  switch(d.kind){
    case 'chart':return preparePlanarFace3(unframe(d.frame),decodeBodyProfile3(d.rings),d.sense);
    case 'rectangle':return prepareRectangleFace3(unframe(d.frame),decodeExactReal3(d.uMin),decodeExactReal3(d.uMax),decodeExactReal3(d.vMin),decodeExactReal3(d.vMax),d.sense);
    case 'circular':return prepareCircularFace3(uncircle(d.outer),d.holes.map(uncircle),d.sense);
    case 'elliptic':return prepareEllipseFace3(unellipse(d.ellipse),d.sense);
  }
}
export function decodeCylinderDomain3(d:CylinderDomainRecord3):PreparedCylinderFace3 {
  const a=decodeCurveRecord3(d.angular);if(a.kind!=='circular-arc')throw new RangeError('Cylinder angular domain must be a spatial circular arc');
  return prepareCylinderFace3(cylinder3(line3(decodeRationalPoint3(d.origin),decodeRationalPoint3(d.direction)),d.radiusSquared),d.lower,d.upper,{angular:a.arc,sense:d.sense});
}
export interface DecodedFaceDomain3 {
  readonly record:FaceDomainRecord3;readonly surface:Surface3;readonly sense:1|-1;
  readonly boundary:readonly (readonly Curve3[])[];readonly sample:AlgebraicCoordinates3;
  locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
/** Builds and validates a bounded analytic domain, not its serialized edge uses
 * or any surrounding shell. Trim components are selected by strict membership.
 */
export function decodeFaceDomain3(input:unknown):DecodedFaceDomain3 {
  const record=readFaceDomainRecord3(input);if(record.kind==='planar-curve-partition-cell'||record.kind==='planar-multi-partition-cell'||record.kind==='cylinder-refined-cell'||record.kind==='cylinder-partition-cell'||record.kind==='planar-partition-cell')throw new RangeError('Partition cells require the mixed face domain decoder');let surface:Surface3,sense:1|-1,boundary:readonly (readonly Curve3[])[],sample:AlgebraicCoordinates3,locate:DecodedFaceDomain3['locate'];
  if(record.kind==='trimmed-planar'||record.kind==='trimmed-cylinder'){
    const isPlanar=record.kind==='trimmed-planar',base=isPlanar?decodePlanarDomain3(record.base):decodeCylinderDomain3(record.base),region=isPlanar?prepareTrimmedPlanar3(base as PreparedPlanarFace3,unplanes(record.halfspaces)):prepareTrimmedCylinder3(base as PreparedCylinderFace3,unplanes(record.halfspaces)),witness=decodeExactPoint3(record.sample),components=region.components.filter(c=>c.locate(witness)==='inside');
    if(components.length!==1)throw new RangeError('Trim domain witness must select exactly one strict interior component');const c=components[0]!;if(c.loops===null)throw new RangeError('Trim component has ambiguous boundary loops');
    surface=isPlanar?{kind:'plane',plane:(base as PreparedPlanarFace3).surface}:{kind:'cylinder',cylinder:(base as PreparedCylinderFace3).surface};sense=base.sense;
    boundary=Object.freeze(c.loops.map(loop=>Object.freeze(loop.map(u=>u.direction===1?region.edges[u.edge]!:reverseCurve3(region.edges[u.edge]!)))));sample=c.sample;locate=p=>c.locate(p);
  }else if(record.kind==='cylinder-product'){
    const f=decodeCylinderDomain3(record);surface={kind:'cylinder',cylinder:f.surface};sense=f.sense;boundary=f.boundary;sample=f.sample;locate=p=>f.locate(p);
  }else {const f=decodePlanarDomain3(record);surface={kind:'plane',plane:f.surface};sense=f.sense;boundary=f.boundary;sample=f.sample;locate=p=>f.locate(p);}
  return Object.freeze({record,surface:Object.freeze(surface),sense,boundary,sample,locate});
}
