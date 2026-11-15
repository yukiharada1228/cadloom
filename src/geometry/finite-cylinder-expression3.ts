import {plane3} from './plane3.js';
import {snapshotExactPoint3,signLinearAlgebraicPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {Point3} from './point3.js';
import {assertOwnedFiniteCylinder3} from './finite-cylinder-boolean3.js';
import type {FiniteCylinder3} from './finite-cylinder-boolean3.js';
import {partitionCylinderFaceByFiniteCylinders3} from './cylinder-face-finite-cylinder3.js';
import type {CylinderFaceFiniteCylindersPartition3} from './cylinder-face-finite-cylinder3.js';
import {partitionPlanarFaceByFiniteCylinders3} from './planar-face-finite-cylinder3.js';
import type {PlanarFaceFiniteCylindersPartition3} from './planar-face-finite-cylinder3.js';
import type {CylinderFaceCell3} from './cylinder-face-cylinder-partition3.js';
import type {PlanarCylinderFaceCell3} from './planar-face-cylinder-partition3.js';
import {surfacesCoincide3,classifyPointToSurface3} from './surface3.js';
import type {Surface3} from './surface3.js';
import {dot3,point3,cross3} from './point3.js';
import {nativeBRepCurve3,reverseBRepCurve3} from './brep-curve3.js';
import type {BRepCurve3} from './brep-curve3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';
import type {SewnMixedBRep3} from './sew-mixed-brep3.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';
import type {BooleanOperation} from './polygon-boolean.js';
export type FiniteCylinderExpression3={readonly kind:'operand';readonly operand:number}|{readonly kind:BooleanOperation;readonly first:FiniteCylinderExpression3;readonly second:FiniteCylinderExpression3};
export interface FiniteCylinderExpressionFace3 {
 readonly surface:Surface3;readonly sense:1|-1;readonly boundary:readonly BRepCurve3[];
 readonly domain:CylinderFaceCell3|PlanarCylinderFaceCell3;
 readonly source:{readonly operand:number;readonly face:0|1|2;readonly cell:number;readonly orientation:1|-1};
}
export interface FiniteCylinderExpressionBoundary3 {
 readonly operands:readonly FiniteCylinder3[];readonly expression:FiniteCylinderExpression3;
 readonly partitions:readonly {readonly wall:CylinderFaceFiniteCylindersPartition3;readonly caps:readonly PlanarFaceFiniteCylindersPartition3[]}[];
 readonly faces:readonly FiniteCylinderExpressionFace3[];readonly sewn:SewnMixedBRep3;readonly empty:boolean;readonly manifold:boolean;
}
const owned=new WeakSet<FiniteCylinderExpressionBoundary3>();
export function assertOwnedFiniteCylinderExpressionBoundary3(input:FiniteCylinderExpressionBoundary3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created cylinder expression boundary');}
function snapshot(tree:FiniteCylinderExpression3,count:number,active=new Set<object>()):FiniteCylinderExpression3 {
 if(tree===null||typeof tree!=='object'||active.has(tree))throw new RangeError('Invalid or cyclic cylinder expression');active.add(tree);let result:FiniteCylinderExpression3;
 if(tree.kind==='operand'){if(!Number.isSafeInteger(tree.operand)||tree.operand<0||tree.operand>=count)throw new RangeError('Invalid cylinder operand index');result=Object.freeze({kind:'operand',operand:tree.operand});}
 else {if(!['union','intersection','difference','xor'].includes(tree.kind))throw new RangeError('Unknown cylinder expression operation');result=Object.freeze({kind:tree.kind,first:snapshot(tree.first,count,active),second:snapshot(tree.second,count,active)});}active.delete(tree);return result;
}
function evaluate(tree:FiniteCylinderExpression3,values:readonly boolean[]):boolean {if(tree.kind==='operand')return values[tree.operand]!;const a=evaluate(tree.first,values),b=evaluate(tree.second,values);switch(tree.kind){case 'union':return a||b;case 'intersection':return a&&b;case 'difference':return a&&!b;case 'xor':return a!==b;}}
/** Construct a regularized expression boundary from complete primitive-face
 * arrangements. This certifies balanced incidence, not generic imported solids. */
export function boundaryFiniteCylinderExpression3(input:readonly FiniteCylinder3[],tree:FiniteCylinderExpression3):FiniteCylinderExpressionBoundary3 {
 if(!input.length)throw new RangeError('At least one finite cylinder is required');input.forEach(assertOwnedFiniteCylinder3);const operands=Object.freeze([...input]),expression=snapshot(tree,operands.length),definitions=operands.map(c=>({cylinder:c.cylinder,lower:c.lower,upper:c.upper})),partitions=Object.freeze(operands.map(c=>Object.freeze({wall:partitionCylinderFaceByFiniteCylinders3(c.wall,definitions),caps:Object.freeze(c.caps.map(cap=>partitionPlanarFaceByFiniteCylinders3(cap,definitions)))}))),faces:FiniteCylinderExpressionFace3[]=[];
 operands.forEach((source,operand)=>{
  function add(domain:CylinderFaceCell3|PlanarCylinderFaceCell3,locations:readonly CurveRegionLocation2[],face:0|1|2,cell:number){
   const surface:Surface3=Object.freeze(face===0?{kind:'cylinder',cylinder:source.cylinder}:{kind:'plane',plane:source.caps[face-1]!.surface}),minus:boolean[]=[],plus:boolean[]=[];
   for(let j=0;j<operands.length;j++){
    const location=locations[j]!;if(location!=='boundary'){minus.push(location==='inside');plus.push(location==='inside');continue;}
    const other=operands[j]!;let same:boolean;
    if(face===0){if(!surfacesCoincide3(surface,{kind:'cylinder',cylinder:other.cylinder}))throw new Error('Open boundary wall lacks coincident radial support');same=true;}
    else {const cap=other.caps.find(c=>surfacesCoincide3(surface,{kind:'plane',plane:c.surface}));if(!cap)throw new Error('Open boundary cap lacks coincident plane support');same=dot3(source.caps[face-1]!.normal,cap.normal).sign()>0;}
    // The earlier primitive supplies the same geometric patch, with its own
    // outward side convention. Emit a coincident patch exactly once.
    if(j<operand)return;minus.push(same);plus.push(!same);
   }
   const inside=evaluate(expression,minus),outside=evaluate(expression,plus);if(inside===outside)return;const orientation=inside?1:-1,curves=face===0?(domain as CylinderFaceCell3).boundary:(domain as PlanarCylinderFaceCell3).boundary.map(nativeBRepCurve3),boundary=Object.freeze(orientation===1?[...curves]:[...curves].reverse().map(reverseBRepCurve3)),sense=((face===0?1:source.caps[face-1]!.sense)*orientation) as 1|-1;faces.push(Object.freeze({surface,sense,boundary,domain,source:Object.freeze({operand,face,cell,orientation})}));
  }
  const part=partitions[operand]!;part.wall.partition.cells.forEach((c,i)=>add(c,part.wall.materialLocations[i]!,0,i));part.caps.forEach((cap,k)=>cap.partition.cells.forEach((c,i)=>add(c,cap.materialLocations[i]!,k+1 as 1|2,i)));
 });
 const sewn=sewMixedBRepFaces3(faces.map(f=>({surface:f.surface,sense:f.sense,loops:[f.boundary]})));for(const edge of sewn.topology.edges)if(edge.coedges.length<2||edge.coedges.reduce((sum,id)=>sum+sewn.topology.coedges[id]!.direction,0)!==0)throw new Error('Cylinder expression boundary has an unbalanced edge');
 const empty=faces.length===0,result=Object.freeze({operands,expression,partitions,faces:Object.freeze(faces),sewn,empty,manifold:empty||sewn.topology.closedOrientedIncidence});owned.add(result);return result;
}

/** Regularized material membership, including points on discarded primitive
 * boundaries. Generic symbolic infinitesimal directions require no epsilon. */
export function locateFiniteCylinderExpression3(source:FiniteCylinderExpressionBoundary3,input:Point3|AlgebraicCoordinates3):CurveRegionLocation2 {
 assertOwnedFiniteCylinderExpressionBoundary3(source);if(source.empty)return 'outside';const p=snapshotExactPoint3(input);if(source.faces.some(f=>f.domain.locate(p)!=='outside'))return 'boundary';
 for(let k=0n;;k++){
  const v=point3(1n,k,k*k),values:boolean[]=[];let retry=false;
  for(const primitive of source.operands){
   const c=primitive.cylinder,d=c.axis.direction,o=c.axis.origin,D=dot3(d,d),dv=dot3(d,v),n=point3(v.x.mul(D).sub(d.x.mul(dv)),v.y.mul(D).sub(d.y.mul(dv)),v.z.mul(D).sub(d.z.mul(dv)));let radial=classifyPointToSurface3(p,{kind:'cylinder',cylinder:c});
   if(radial===0){radial=signLinearAlgebraicPoint3(p,n,dot3(n,o).neg());if(radial===0){const cross=cross3(d,v);if(dot3(cross,cross).sign()===0){retry=true;break;}radial=1;}}
   const cap=(t:typeof primitive.lower)=>{const normal=d,offset=dot3(d,o).add(D.mul(t)).neg(),sign=classifyPointToSurface3(p,{kind:'plane',plane:plane3(normal.x,normal.y,normal.z,offset)});return sign===0?dv.sign():sign;},lo=cap(primitive.lower),hi=cap(primitive.upper);if(lo===0||hi===0){retry=true;break;}values.push(radial<0&&lo>0&&hi<0);
  }
  if(!retry)return evaluate(source.expression,values)?'inside':'outside';
 }
}
