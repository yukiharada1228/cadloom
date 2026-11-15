import {Rational} from '../numeric/rational.js';
import type {ExactInput} from './point2.js';
import {point3,dot3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3} from './plane3.js';
import {classifyPointToSurface3,surfacesCoincide3} from './surface3.js';
import type {Cylinder3,Surface3} from './surface3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {circle3} from './circle3.js';
import {prepareCircularFace3} from './planar-face3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';
import {prepareCylinderFace3} from './cylinder-face3.js';
import type {PreparedCylinderFace3} from './cylinder-face3.js';
import {partitionCylinderFaceByFiniteCylinder3} from './cylinder-face-finite-cylinder3.js';
import type {CylinderFaceFiniteCylinderPartition3} from './cylinder-face-finite-cylinder3.js';
import {partitionPlanarFaceByFiniteCylinder3} from './planar-face-finite-cylinder3.js';
import type {PlanarFaceFiniteCylinderPartition3} from './planar-face-finite-cylinder3.js';
import type {CylinderFaceCell3} from './cylinder-face-cylinder-partition3.js';
import type {PlanarCylinderFaceCell3} from './planar-face-cylinder-partition3.js';
import {nativeBRepCurve3,reverseBRepCurve3} from './brep-curve3.js';
import type {BRepCurve3} from './brep-curve3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';
import type {SewnMixedBRep3} from './sew-mixed-brep3.js';
import type {BooleanOperation} from './polygon-boolean.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';
export interface FiniteCylinder3 {
 readonly cylinder:Cylinder3;readonly lower:Rational;readonly upper:Rational;
 readonly wall:PreparedCylinderFace3;readonly caps:readonly [PreparedPlanarFace3,PreparedPlanarFace3];
 readonly sewn:SewnMixedBRep3;
 locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
const primitives=new WeakSet<FiniteCylinder3>();
export function assertOwnedFiniteCylinder3(input:FiniteCylinder3):void {if(!primitives.has(input))throw new RangeError('Expected a factory-created finite cylinder');}
/** Embedded filled finite cylinder. Axis bounds are parameters, not unit lengths. */
export function prepareFiniteCylinder3(input:Cylinder3,lower:ExactInput,upper:ExactInput):FiniteCylinder3 {
 const wall=prepareCylinderFace3(input,lower,upper),cylinder=wall.surface,o=cylinder.axis.origin,d=cylinder.axis.direction,D=dot3(d,d),cap=(t:Rational,sense:1|-1)=>prepareCircularFace3(circle3(point3(o.x.add(d.x.mul(t)),o.y.add(d.y.mul(t)),o.z.add(d.z.mul(t))),d,cylinder.radiusSquared),[],sense),caps=Object.freeze([cap(wall.lower,-1),cap(wall.upper,1)]) as readonly [PreparedPlanarFace3,PreparedPlanarFace3],at=(t:Rational)=>plane3(d.x,d.y,d.z,dot3(o,d).add(D.mul(t)).neg()),lo=at(wall.lower),hi=at(wall.upper);
 const sewn=sewMixedBRepFaces3([{surface:{kind:'cylinder',cylinder},sense:1,loops:wall.boundary.map(loop=>loop.map(nativeBRepCurve3))},...caps.map(c=>({surface:{kind:'plane' as const,plane:c.surface},sense:c.sense,loops:c.boundary.map(loop=>loop.map(nativeBRepCurve3))}))],{requireClosed:true});
 const locate:FiniteCylinder3['locate']=p=>{const radial=classifyPointToSurface3(p,{kind:'cylinder',cylinder}),a=classifyPointToSurface3(p,{kind:'plane',plane:lo}),b=classifyPointToSurface3(p,{kind:'plane',plane:hi});return radial>0||a<0||b>0?'outside':radial===0||a===0||b===0?'boundary':'inside';},result=Object.freeze({cylinder,lower:wall.lower,upper:wall.upper,wall,caps,sewn,locate});primitives.add(result);return result;
}
export interface FiniteCylinderFaceSource3 {
 readonly operand:0|1;
 /** Primitive faces: 0 wall, 1 lower cap, 2 upper cap. */
 readonly face:0|1|2;readonly cell:number;readonly orientation:1|-1;
}
export interface FiniteCylinderBooleanFace3 {
 readonly surface:Surface3;readonly sense:1|-1;readonly boundary:readonly BRepCurve3[];
 readonly domain:CylinderFaceCell3|PlanarCylinderFaceCell3;
 readonly source:FiniteCylinderFaceSource3;
}
export interface FiniteCylinderBoolean3 {
 readonly first:FiniteCylinder3;readonly second:FiniteCylinder3;readonly operation:BooleanOperation;
 readonly partitions:readonly [FiniteCylinderOperandPartition3,FiniteCylinderOperandPartition3];
 readonly empty:boolean;readonly faces:readonly FiniteCylinderBooleanFace3[];readonly sewn:SewnMixedBRep3;
 /** False for balanced nonmanifold contact boundaries; never a generic Body certificate. */
 readonly manifold:boolean;
 locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
export interface FiniteCylinderOperandPartition3 {readonly wall:CylinderFaceFiniteCylinderPartition3;readonly caps:readonly [PlanarFaceFiniteCylinderPartition3,PlanarFaceFiniteCylinderPartition3];}
const cache=new WeakMap<FiniteCylinder3,WeakMap<FiniteCylinder3,readonly [FiniteCylinderOperandPartition3,FiniteCylinderOperandPartition3]>>(),results=new WeakSet<FiniteCylinderBoolean3>();
export function assertOwnedFiniteCylinderBoolean3(input:FiniteCylinderBoolean3):void {if(!results.has(input))throw new RangeError('Expected a factory-created finite cylinder Boolean');}
function partitions(a:FiniteCylinder3,b:FiniteCylinder3):readonly [FiniteCylinderOperandPartition3,FiniteCylinderOperandPartition3] {
 let inner=cache.get(a);if(!inner){inner=new WeakMap();cache.set(a,inner);}const known=inner.get(b);if(known)return known;
 const build=(x:FiniteCylinder3,y:FiniteCylinder3):FiniteCylinderOperandPartition3=>Object.freeze({wall:partitionCylinderFaceByFiniteCylinder3(x.wall,y.cylinder,y.lower,y.upper),caps:Object.freeze([partitionPlanarFaceByFiniteCylinder3(x.caps[0],y.cylinder,y.lower,y.upper),partitionPlanarFaceByFiniteCylinder3(x.caps[1],y.cylinder,y.lower,y.upper)]) as readonly [PlanarFaceFiniteCylinderPartition3,PlanarFaceFiniteCylinderPartition3]});const pair=Object.freeze([build(a,b),build(b,a)]) as readonly [FiniteCylinderOperandPartition3,FiniteCylinderOperandPartition3];inner.set(b,pair);return pair;
}
function selection(operation:BooleanOperation,owner:0|1,location:CurveRegionLocation2,coincident:'same'|'opposite'|null):1|-1|0 {
 if(location==='boundary'){
  if(!coincident)throw new Error('Boundary patch lacks a supporting orientation');
  return coincident==='same'?(operation==='union'||operation==='intersection')&&owner===0?1:0:operation==='difference'&&owner===0?1:0;
 }
 if(operation==='union')return location==='outside'?1:0;
 if(operation==='intersection')return location==='inside'?1:0;
 if(operation==='difference')return owner===0?location==='outside'?1:0:location==='inside'?-1:0;
 return location==='inside'?-1:1;
}
/** Regularized Boolean boundary of two owned filled finite cylinders. Native
 * caps and algebraic SSI walls are selected geometrically and sewn together.
 * Retains artificial face subdivisions and balanced nonmanifold contacts.
 * Results are not yet operands for arbitrary curved Booleans or common Body records.
 */
export function booleanFiniteCylinders3(first:FiniteCylinder3,second:FiniteCylinder3,operation:BooleanOperation):FiniteCylinderBoolean3 {
 assertOwnedFiniteCylinder3(first);assertOwnedFiniteCylinder3(second);if(!['union','intersection','difference','xor'].includes(operation))throw new RangeError('Unknown Boolean operation');
 const split=partitions(first,second),faces:FiniteCylinderBooleanFace3[]=[];
 for(const operand of [0,1] as const){const source=operand===0?first:second,other=operand===0?second:first,parts=split[operand];
  function add(domain:CylinderFaceCell3|PlanarCylinderFaceCell3,face:0|1|2,cell:number,location:CurveRegionLocation2,coincident:'same'|'opposite'|null){
   const direction=selection(operation,operand,location,coincident);if(direction===0)return;const surface:Surface3=face===0?{kind:'cylinder',cylinder:source.cylinder}:{kind:'plane',plane:source.caps[face-1]!.surface},sense=((face===0?1:source.caps[face-1]!.sense)*direction) as 1|-1,curves=face===0?(domain as CylinderFaceCell3).boundary:(domain as PlanarCylinderFaceCell3).boundary.map(nativeBRepCurve3),boundary=Object.freeze(direction===1?[...curves]:[...curves].reverse().map(reverseBRepCurve3));faces.push(Object.freeze({surface:Object.freeze(surface),sense,boundary,domain,source:Object.freeze({operand,face,cell,orientation:direction})}));
  }
  parts.wall.partition.cells.forEach((domain,i)=>{const location=parts.wall.materialLocations[i]!;if(location==='boundary'&&!surfacesCoincide3({kind:'cylinder',cylinder:source.cylinder},{kind:'cylinder',cylinder:other.cylinder}))throw new Error('Coincident wall label lacks equal supports');add(domain,0,i,location,location==='boundary'?'same':null);});
  parts.caps.forEach((p,cap)=>p.partition.cells.forEach((domain,i)=>{const location=p.materialLocations[i]!;let coincident:'same'|'opposite'|null=null;if(location==='boundary'){const sides=domain.planeSides,normal=source.caps[cap]!.normal,sign=dot3(normal,other.cylinder.axis.direction).sign()*(sides[0]===0?-1:1);if(sign===0||sides.every(s=>s!==0))throw new Error('Coincident cap label lacks parallel active normals');coincident=sign>0?'same':'opposite';}add(domain,(cap+1) as 1|2,i,location,coincident);}));
 }
 const sewn=sewMixedBRepFaces3(faces.map(f=>({surface:f.surface,sense:f.sense,loops:[f.boundary]})));
 for(const edge of sewn.topology.edges)if(edge.coedges.length<2||edge.coedges.reduce((sum,id)=>sum+sewn.topology.coedges[id]!.direction,0)!==0)throw new Error('Cylinder Boolean boundary has an unbalanced edge');
 const empty=faces.length===0,manifold=empty||sewn.topology.closedOrientedIncidence;
 function opposedCapAt(p:Point3|AlgebraicCoordinates3):boolean {return first.caps.some(a=>second.caps.some(b=>dot3(a.normal,b.normal).sign()<0&&surfacesCoincide3({kind:'plane',plane:a.surface},{kind:'plane',plane:b.surface})&&a.locate(p)!=='outside'&&b.locate(p)!=='outside'));}
 const locate:FiniteCylinderBoolean3['locate']=p=>{
  if(empty)return 'outside';if(faces.some(f=>f.domain.locate(p)!=='outside'))return 'boundary';const a=first.locate(p),b=second.locate(p);
  if(operation==='union')return a!=='outside'||b!=='outside'?'inside':'outside';
  if(operation==='intersection')return a==='inside'&&b==='inside'?'inside':'outside';
  if(operation==='difference')return a==='inside'&&b==='outside'?'inside':'outside';
  return a==='inside'&&b==='outside'||b==='inside'&&a==='outside'||a==='boundary'&&b==='boundary'&&opposedCapAt(p)?'inside':'outside';
 };
 const result=Object.freeze({first,second,operation,partitions:split,empty,faces:Object.freeze(faces),sewn,manifold,locate});results.add(result);return result;
}
