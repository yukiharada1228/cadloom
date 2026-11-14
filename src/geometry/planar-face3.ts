import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {Sign} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import type {Point3,Vector3} from './point3.js';
import {point2} from './point2.js';
import type {ExactInput} from './point2.js';
import {algebraicCoordinates2,algebraicPoint2} from './algebraic-point2.js';
import {point3,vector3,dot3,cross3,subtract3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {line3,classifyPointToSurface3} from './surface3.js';
import {algebraicPoint3,snapshotExactPoint3,getPointParameterization3,translateAlgebraicPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {planeFrame3,mapPlanePoint3,pointInPlaneFrame3,lineInterval3,planarArc3,reverseCurve3,translateCurve3} from './curve3.js';
import {algebraicSegment3} from './algebraic-segment3.js';
import type {PlaneFrame3,Curve3} from './curve3.js';
import {circle3,circlePlane3,fullCircleArc3} from './circle3.js';
import type {Circle3} from './circle3.js';
import {ellipse3,ellipsePlane3,fullEllipseArc3,locatePointInEllipse3} from './ellipse3.js';
import type {Ellipse3} from './ellipse3.js';
import {booleanCurveRegions2} from './curve-boolean2.js';
import type {CurveRegion2,CurveBoundary2,CurveBooleanResult2,CurveRegionLocation2} from './curve-boolean2.js';
import {buildBRepTopology3} from './brep-topology3.js';
import type {BRepEdgeUse3,BRepTopology3} from './brep-topology3.js';

export type PlanarFaceDomain3=
 | {readonly kind:'chart';readonly frame:PlaneFrame3;readonly region:CurveBooleanResult2}
 | {readonly kind:'rectangle';readonly frame:PlaneFrame3;readonly uMin:AlgebraicReal;readonly uMax:AlgebraicReal;readonly vMin:AlgebraicReal;readonly vMax:AlgebraicReal}
 | {readonly kind:'circular';readonly outer:Circle3;readonly holes:readonly Circle3[]}
 | {readonly kind:'elliptic';readonly ellipse:Ellipse3};
/** Nonempty connected compact planar region with disjoint manifold boundary loops,
 * oriented relative to its support. Not a shell or embedded-solid certificate.
 */
export interface PreparedPlanarFace3 {
  readonly domain:PlanarFaceDomain3;
  readonly surface:Plane3;
  readonly sense:1|-1;
  readonly normal:Vector3;
  readonly boundary:readonly (readonly Curve3[])[];
  readonly topology:BRepTopology3;
  readonly sample:AlgebraicCoordinates3;
  locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
const zero=new Rational(0n),two=new Rational(2n),four=new Rational(4n);
const ownedFaces=new WeakSet<PreparedPlanarFace3>();
function assertSense(sense:1|-1):void {if(sense!==1&&sense!==-1)throw new RangeError('Face sense must be +1 or -1');}
function assemble(domain:PlanarFaceDomain3,surface:Plane3,sense:1|-1,boundary:readonly (readonly Curve3[])[],sample:AlgebraicCoordinates3,locate:PreparedPlanarFace3['locate']):PreparedPlanarFace3 {
  const rings=Object.freeze(boundary.map(r=>Object.freeze([...r]))),edges:Curve3[]=[],loops:BRepEdgeUse3[][]=[];
  for(const ring of rings){const loop:BRepEdgeUse3[]=[];for(const curve of ring){loop.push({edge:edges.length,direction:1});edges.push(curve);}loops.push(loop);}
  const topology=buildBRepTopology3(edges,[{surface:{kind:'plane',plane:surface},sense,loops}]);
  if(!topology.manifoldVertices)throw new Error('Certified planar domain has invalid boundary incidence');
  const n=surface.normal,normal=vector3(n.x.mul(new Rational(BigInt(sense))),n.y.mul(new Rational(BigInt(sense))),n.z.mul(new Rational(BigInt(sense))));
  const result=Object.freeze({domain,surface,sense,normal,boundary:rings,topology,sample,locate});
  ownedFaces.add(result);return result;
}
/** Injective rational chart rectangle with exact algebraic coordinate bounds. */
export function prepareRectangleFace3(inputFrame:PlaneFrame3,inputUMin:AlgebraicReal|ExactInput,inputUMax:AlgebraicReal|ExactInput,inputVMin:AlgebraicReal|ExactInput,inputVMax:AlgebraicReal|ExactInput,sense:1|-1=1):PreparedPlanarFace3 {
  assertSense(sense);const frame=planeFrame3(inputFrame.origin,inputFrame.u,inputFrame.v),real=(x:AlgebraicReal|ExactInput)=>x instanceof AlgebraicReal?x:AlgebraicReal.fromRational(x),uMin=real(inputUMin),uMax=real(inputUMax),vMin=real(inputVMin),vMax=real(inputVMax);
  if(uMin.compare(uMax)>=0||vMin.compare(vMax)>=0)throw new RangeError('Rectangle bounds must be strictly increasing');
  const map=(u:AlgebraicReal,v:AlgebraicReal)=>mapPlanePoint3(frame,v.rational!==null?algebraicPoint2(point2(0n,v.rational),point2(1n,0n),u):u.rational!==null?algebraicPoint2(point2(u.rational,0n),point2(0n,1n),v):algebraicCoordinates2(u,v));
  const points=[map(uMin,vMin),map(uMax,vMin),map(uMax,vMax),map(uMin,vMax)];
  let boundary:Curve3[]=points.map((p,i)=>Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(p,points[(i+1)%4]!)}));
  if(sense===-1)boundary=boundary.reverse().map(reverseCurve3);
  const n=cross3(frame.u,frame.v),surface=plane3(n.x,n.y,n.z,dot3(n,frame.origin).neg()),sample=map(uMin.add(uMax).affine('1/2'),vMin.add(vMax).affine('1/2'));
  const locate:PreparedPlanarFace3['locate']=p=>{
    const local=pointInPlaneFrame3(frame,p);if(local===null)return 'outside';
    const a=local.x.compare(uMin),b=local.x.compare(uMax),c=local.y.compare(vMin),d=local.y.compare(vMax);
    return a<0||b>0||c<0||d>0?'outside':a===0||b===0||c===0||d===0?'boundary':'inside';
  };
  return assemble(Object.freeze({kind:'rectangle',frame,uMin,uMax,vMin,vMax}),surface,sense,[boundary],sample,locate);
}
/** Translates a factory-owned verified planar domain without re-noding its trims.
 * Optional sense changes reverse the complete physical boundary orientation.
 */
export function translatePlanarFace3(input:PreparedPlanarFace3,translation:Vector3,sense:1|-1=input.sense):PreparedPlanarFace3 {
  assertSense(sense);if(!ownedFaces.has(input))throw new RangeError('Face translation requires a factory-created planar face');
  const v=vector3(translation.x,translation.y,translation.z),move=(p:Point3)=>point3(p.x.add(v.x),p.y.add(v.y),p.z.add(v.z)),domain=input.domain;
  let next:PlanarFaceDomain3;
  if(domain.kind==='elliptic'){const e=domain.ellipse;next=Object.freeze({kind:'elliptic',ellipse:ellipse3(planeFrame3(move(e.frame.origin),e.frame.u,e.frame.v),e.radiusUSquared,e.radiusVSquared)});}
  else if(domain.kind==='circular')next=Object.freeze({kind:'circular',outer:circle3(move(domain.outer.center),domain.outer.normal,domain.outer.radiusSquared),holes:Object.freeze(domain.holes.map(c=>circle3(move(c.center),c.normal,c.radiusSquared)))});
  else {const f=domain.frame,frame=planeFrame3(move(f.origin),f.u,f.v);next=domain.kind==='chart'?Object.freeze({kind:'chart',frame,region:domain.region}):Object.freeze({...domain,frame});}
  let boundary=input.boundary.map(r=>r.map(c=>translateCurve3(c,v)));if(sense!==input.sense)boundary=boundary.map(r=>r.reverse().map(reverseCurve3));
  const p=input.surface,surface=plane3(p.normal.x,p.normal.y,p.normal.z,p.offset.sub(dot3(p.normal,v))),sample=translateAlgebraicPoint3(input.sample,v),negative=vector3(v.x.neg(),v.y.neg(),v.z.neg());
  return assemble(next,surface,sense,boundary,sample,point=>input.locate(translateAlgebraicPoint3(point,negative)));
}
function liftBoundary(frame:PlaneFrame3,curve:CurveBoundary2):Curve3 {
  if(curve.kind==='arc')return Object.freeze({kind:'planar-arc',arc:planarArc3(frame,curve.arc)});
  const map=(p:{readonly x:Rational;readonly y:Rational},direction=false)=>{
    const component=(k:'x'|'y'|'z')=>frame.u[k].mul(p.x).add(frame.v[k].mul(p.y)).add(direction?zero:frame.origin[k]);
    return point3(component('x'),component('y'),component('z'));
  };
  if(curve.kind==='line')return Object.freeze({kind:'line',interval:lineInterval3(line3(map(curve.interval.line.origin),map(curve.interval.line.direction,true)),curve.interval.startParameter,curve.interval.endParameter)});
  const a=map(curve.segment.start),b=map(curve.segment.end);
  return Object.freeze({kind:'line',interval:lineInterval3(line3(a,subtract3(b,a)),0n,1n)});
}
/** Validates already oriented chart boundary walks; does not silently repair
 * self-crossing, touching, duplicate, canceled, internal or disconnected boundaries.
 * All material windings must equal sense (not merely be nonzero).
 */
export function preparePlanarFace3(inputFrame:PlaneFrame3,input:CurveRegion2,sense:1|-1=1):PreparedPlanarFace3 {
  assertSense(sense);
  const frame=planeFrame3(inputFrame.origin,inputFrame.u,inputFrame.v),region=booleanCurveRegions2(input,[],'union','nonzero'),a=region.arrangement;
  if(!region.selectedFaces.length)throw new RangeError('A planar face must have nonempty interior');
  if(region.selectedFaces.length!==1)throw new RangeError('A planar face must have connected interior without internal boundaries');
  if(region.windings.some(w=>w[0]!==0n&&w[0]!==BigInt(sense)))throw new RangeError('Boundary winding must agree with the face sense with unit multiplicity');
  const selected=new Set(region.selectedFaces);
  const sources=new Set(a.edges.flatMap(edge=>edge.uses.map(use=>use.source)));
  if(sources.size!==input.reduce((count,ring)=>count+ring.length,0))throw new RangeError('Point boundary primitives are not valid face edges');
  a.edges.forEach((edge,id)=>{
    if(edge.uses.length!==1||selected.has(a.halfEdgeFaces[2*id]!)===selected.has(a.halfEdgeFaces[2*id+1]!))throw new RangeError('Input must contain only singly used face boundary curves');
  });
  if(a.outgoing.some(ids=>ids.length!==2))throw new RangeError('Face boundary loops must be disjoint manifold curves without point degeneracies');
  const n=cross3(frame.u,frame.v),surface=plane3(n.x,n.y,n.z,dot3(n,frame.origin).neg());
  let boundary=region.rings.map(r=>r.map(c=>liftBoundary(frame,c)));
  if(sense===-1)boundary=boundary.map(r=>r.slice().reverse().map(reverseCurve3));
  const localSample=a.faces[region.selectedFaces[0]!]!.sample,sample=mapPlanePoint3(frame,localSample);
  const locate:PreparedPlanarFace3['locate']=point=>{const p=pointInPlaneFrame3(frame,point);return p===null?'outside':region.locate(p);};
  return assemble(Object.freeze({kind:'chart',frame,region}),surface,sense,boundary,sample,locate);
}
function distanceSign(point:AlgebraicCoordinates3,circle:Circle3):Sign {
  const data=getPointParameterization3(point);
  if(data){const q=subtract3(data.origin,circle.center),d=data.direction;return data.parameter.signOf(new Polynomial([dot3(q,q).sub(circle.radiusSquared),dot3(q,d).mul(two),dot3(d,d)]));}
  const x=point.x.affine(1n,circle.center.x.neg()),y=point.y.affine(1n,circle.center.y.neg()),z=point.z.affine(1n,circle.center.z.neg());
  return x.mul(x).add(y.mul(y)).add(z.mul(z)).affine(1n,circle.radiusSquared.neg()).sign();
}
/** Arbitrary-rational-normal disk with zero or more strictly disjoint circular
 * holes. Unlike rational affine-circle charts this covers every rational normal.
 * Hole tangencies, overlap, nesting, point holes and off-plane holes are rejected.
 */
export function prepareCircularFace3(inputOuter:Circle3,inputHoles:readonly Circle3[]=[],sense:1|-1=1):PreparedPlanarFace3 {
  assertSense(sense);
  const outer=circle3(inputOuter.center,inputOuter.normal,inputOuter.radiusSquared),surface=circlePlane3(outer);
  if(outer.radiusSquared.sign()===0)throw new RangeError('A planar face requires positive area');
  const holes=inputHoles.map(input=>{
    const c=circle3(input.center,input.normal,input.radiusSquared),cross=cross3(outer.normal,c.normal);
    if(c.radiusSquared.sign()===0)throw new RangeError('A circular hole must have positive radius');
    if(dot3(cross,cross).sign()!==0||classifyPointToSurface3(c.center,{kind:'plane',plane:surface})!==0)throw new RangeError('Hole must share the outer circle plane');
    const q=subtract3(c.center,outer.center),L=dot3(q,q),A=outer.radiusSquared.sub(L).sub(c.radiusSquared);
    if(A.sign()<=0||A.mul(A).compare(L.mul(c.radiusSquared).mul(four))<=0)throw new RangeError('Hole must lie strictly inside the outer circle');
    return circle3(c.center,outer.normal,c.radiusSquared);
  });
  for(let i=0;i<holes.length;i++)for(let j=0;j<i;j++){
    const a=holes[i]!,b=holes[j]!,q=subtract3(a.center,b.center),L=dot3(q,q),A=L.sub(a.radiusSquared).sub(b.radiusSquared);
    if(A.sign()<=0||A.mul(A).compare(a.radiusSquared.mul(b.radiusSquared).mul(four))<=0)throw new RangeError('Circular holes must have strictly disjoint closed disks');
  }
  const frozenHoles=Object.freeze(holes),locate:PreparedPlanarFace3['locate']=input=>{
    const p=snapshotExactPoint3(input);if(classifyPointToSurface3(p,{kind:'plane',plane:surface})!==0)return 'outside';
    const side=distanceSign(p,outer);if(side>0)return 'outside';if(side===0)return 'boundary';
    for(const hole of holes){const sign=distanceSign(p,hole);if(sign<0)return 'outside';if(sign===0)return 'boundary';}return 'inside';
  };
  const outerArc=fullCircleArc3(outer,sense===1?'ccw':'cw'),boundary:Curve3[][]=[[Object.freeze({kind:'circular-arc',arc:outerArc})],...holes.map(h=>[Object.freeze({kind:'circular-arc' as const,arc:fullCircleArc3(h,sense===1?'cw':'ccw')})])];
  const data=getPointParameterization3(outerArc.start);if(!data)throw new Error('Full-circle seam lost its construction parameter');
  // Dyadic interior points approach a boundary point separated from every hole.
  // Strict containment and finiteness guarantee eventual membership, with no tolerance/cap.
  let denominator=2n,sample:AlgebraicCoordinates3;
  while(true){sample=algebraicPoint3(outer.center,data.direction,data.parameter.affine(new Rational(denominator-1n,denominator)));if(locate(sample)==='inside')break;denominator*=2n;}
  return assemble(Object.freeze({kind:'circular',outer,holes:frozenHoles}),surface,sense,boundary,sample,locate);
}

/** Embedded closed ellipse disk with exact rational conjugate chart axes. */
export function prepareEllipseFace3(input:Ellipse3,sense:1|-1=1):PreparedPlanarFace3 {
  assertSense(sense);const e=ellipse3(input.frame,input.radiusUSquared,input.radiusVSquared),surface=ellipsePlane3(e),arc=fullEllipseArc3(e,sense===1?'ccw':'cw');
  return assemble(Object.freeze({kind:'elliptic',ellipse:e}),surface,sense,[[Object.freeze({kind:'elliptic-arc',arc})]],snapshotExactPoint3(e.frame.origin),p=>{const where=locatePointInEllipse3(p,e);return where==='inside'?'inside':where;});
}
