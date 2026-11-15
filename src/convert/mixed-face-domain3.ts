import {partitionPlanarFaceByCurves3,assertOwnedPlanarFaceCurvePartition3} from '../geometry/planar-face-cylinder-partition3.js';
import type {PlanarFaceCurvePartition3} from '../geometry/planar-face-cylinder-partition3.js';
import type {PlanarCurveCellDomainRecord3} from '../record/face-domain3.js';
import {refineCylinderFaceCells3,assertOwnedCylinderFaceRefinement3} from '../geometry/cylinder-cell-refinement3.js';
import type {CylinderFaceRefinement3,CylinderFaceRefinementInput3} from '../geometry/cylinder-cell-refinement3.js';
import {partitionPlanarFaceByCylinders3,partitionPlanarFaceByCylinder3,assertOwnedPlanarFaceCylinderPartition3} from '../geometry/planar-face-cylinder-partition3.js';
import type {PlanarFaceCylinderPartition3} from '../geometry/planar-face-cylinder-partition3.js';
import {readFaceDomainRecord3} from '../record/face-domain3.js';
import type {CylinderCellDomainRecord3,PlanarCellDomainRecord3,PlanarMultiCellDomainRecord3,RefinedCylinderCellDomainRecord3} from '../record/face-domain3.js';
import {decodeCylinderDomain3,encodeCylinderDomain3,encodePlanarDomain3,decodePlanarDomain3,decodeFaceDomain3} from './face-domain3.js';
import {encodeRationalPoint3,decodeRationalPoint3,encodeExactPoint3,decodeExactPoint3} from './exact3.js';
import {decodeSurfaceRecord3,encodeSurfaceRecord3,decodeCurveRecord3,encodeCurveRecord3} from './geometry3.js';
import {line3,cylinder3} from '../geometry/surface3.js';
import type {Surface3} from '../geometry/surface3.js';
import {plane3} from '../geometry/plane3.js';
import {prepareCylinderFace3} from '../geometry/cylinder-face3.js';
import {partitionCylinderFaceByCylinder3,assertOwnedCylinderFaceCylinderPartition3} from '../geometry/cylinder-face-cylinder-partition3.js';
import type {CylinderFaceCylinderPartition3} from '../geometry/cylinder-face-cylinder-partition3.js';
import {partitionCylinderFaceCellsByPlane3,assertOwnedCylinderFacePlanePartition3} from '../geometry/cylinder-cell-plane-partition3.js';
import type {CylinderFacePlanePartition3} from '../geometry/cylinder-cell-plane-partition3.js';
import {nativeBRepCurve3,reverseBRepCurve3} from '../geometry/brep-curve3.js';
import type {BRepCurve3} from '../geometry/brep-curve3.js';
import type {DecodedFaceDomain3} from './face-domain3.js';
type Partition=CylinderFaceCylinderPartition3|CylinderFacePlanePartition3;
export interface DecodedMixedFaceDomain3 extends Omit<DecodedFaceDomain3,'boundary'> {readonly boundary:readonly (readonly BRepCurve3[])[];}
/** Store definitions and a strict witness; never trust a serialized cell index. */
export function encodePlanarCurveCellDomain3(input:PlanarFaceCurvePartition3,cell:number,orientation:1|-1=1):PlanarCurveCellDomainRecord3 {
 assertOwnedPlanarFaceCurvePartition3(input);
 if(!Number.isSafeInteger(cell)||cell<0||cell>=input.cells.length)throw new RangeError('Invalid planar curve partition cell');
 if(orientation!==1&&orientation!==-1)throw new RangeError('Invalid face orientation');
 return Object.freeze({kind:'planar-curve-partition-cell',base:encodePlanarDomain3(input.base),curves:Object.freeze(input.cutCurves.map(encodeCurveRecord3)),sample:encodeExactPoint3(input.cells[cell]!.sample),orientation});
}
export function encodeCylinderCellDomain3(input:Partition,cell:number,orientation:1|-1=1):CylinderCellDomainRecord3 {
 const refined='planes' in input;if(refined)assertOwnedCylinderFacePlanePartition3(input);else assertOwnedCylinderFaceCylinderPartition3(input);
 if(!Number.isSafeInteger(cell)||cell<0||cell>=input.cells.length)throw new RangeError('Invalid cylinder partition cell');if(orientation!==1&&orientation!==-1)throw new RangeError('Invalid face orientation');
 const c=input.cutter;return Object.freeze({kind:'cylinder-partition-cell',base:encodeCylinderDomain3(input.base),cutter:Object.freeze({origin:encodeRationalPoint3(c.axis.origin),direction:encodeRationalPoint3(c.axis.direction),radiusSquared:c.radiusSquared.toString()}),planes:Object.freeze((refined?input.planes:[]).map(p=>Object.freeze({normal:encodeRationalPoint3(p.normal),offset:p.offset.toString()}))),sample:encodeExactPoint3(input.cells[cell]!.sample),orientation});
}
export function encodePlanarCellDomain3(input:PlanarFaceCylinderPartition3,cell:number,orientation:1|-1=1):PlanarCellDomainRecord3 {
 assertOwnedPlanarFaceCylinderPartition3(input);if(input.cutters.length!==1)throw new RangeError('Multiple-cylinder planar partitions require a multi-cutter domain record');if(!Number.isSafeInteger(cell)||cell<0||cell>=input.cells.length)throw new RangeError('Invalid planar partition cell');if(orientation!==1&&orientation!==-1)throw new RangeError('Invalid face orientation');
 const c=input.cutter;return Object.freeze({kind:'planar-partition-cell',base:encodePlanarDomain3(input.base),cutter:Object.freeze({origin:encodeRationalPoint3(c.axis.origin),direction:encodeRationalPoint3(c.axis.direction),radiusSquared:c.radiusSquared.toString()}),planes:Object.freeze(input.planes.map(p=>Object.freeze({normal:encodeRationalPoint3(p.normal),offset:p.offset.toString()}))),sample:encodeExactPoint3(input.cells[cell]!.sample),orientation});
}
export function encodePlanarMultiCellDomain3(input:PlanarFaceCylinderPartition3,cell:number,orientation:1|-1=1):PlanarMultiCellDomainRecord3 {
 assertOwnedPlanarFaceCylinderPartition3(input);if(!Number.isSafeInteger(cell)||cell<0||cell>=input.cells.length)throw new RangeError('Invalid planar cell');if(orientation!==1&&orientation!==-1)throw new RangeError('Invalid orientation');
 return Object.freeze({kind:'planar-multi-partition-cell',base:encodePlanarDomain3(input.base),cutters:Object.freeze(input.cutters.map(c=>Object.freeze({origin:encodeRationalPoint3(c.axis.origin),direction:encodeRationalPoint3(c.axis.direction),radiusSquared:c.radiusSquared.toString()}))),planes:Object.freeze(input.planes.map(p=>Object.freeze({normal:encodeRationalPoint3(p.normal),offset:p.offset.toString()}))),sample:encodeExactPoint3(input.cells[cell]!.sample),orientation});
}
export function encodeRefinedCylinderCellDomain3(input:CylinderFaceRefinement3,cell:number,orientation:1|-1=1):RefinedCylinderCellDomainRecord3 {
 assertOwnedCylinderFaceRefinement3(input);if(!Number.isSafeInteger(cell)||cell<0||cell>=input.cells.length)throw new RangeError('Invalid refined cylinder cell');if(orientation!==1&&orientation!==-1)throw new RangeError('Invalid face orientation');const c=input.cutter;
 return Object.freeze({kind:'cylinder-refined-cell',base:encodeCylinderDomain3(input.base),cutter:Object.freeze({origin:encodeRationalPoint3(c.axis.origin),direction:encodeRationalPoint3(c.axis.direction),radiusSquared:c.radiusSquared.toString()}),cuts:Object.freeze(input.cuts.map(encodeSurfaceRecord3)),sample:encodeExactPoint3(input.cells[cell]!.sample),orientation});
}
/** Recompute a complete constructive partition and select by strict membership,
 * never by an unchecked serialized cell index or caller-supplied bound ordering. */
export function decodeMixedFaceDomain3(input:unknown):DecodedMixedFaceDomain3 {return createMixedFaceDomainDecoder3()(input);}
/** Definition-only caches live for this explicit batch; witness selection and
 * orientation are validated separately for every decoded face. */
export function createMixedFaceDomainDecoder3() {
 const curvePartitions=new Map<string,PlanarFaceCurvePartition3>();
 const planarPartitions=new Map<string,PlanarFaceCylinderPartition3>(),cylinderPartitions=new Map<string,Partition>(),refinedPartitions=new Map<string,CylinderFaceRefinementInput3>();
 return (input:unknown):DecodedMixedFaceDomain3=>{
 const record=readFaceDomainRecord3(input);
 if(record.kind==='planar-curve-partition-cell'){
  const {sample:_sample,orientation:_orientation,...definition}=record,key=JSON.stringify(definition);
  let partition=curvePartitions.get(key);
  if(!partition){partition=partitionPlanarFaceByCurves3(decodePlanarDomain3(record.base),record.curves.map(c=>{const curve=decodeCurveRecord3(c);if(curve.kind==='nurbs')throw new RangeError('Planar curve cells do not support NURBS cuts');return curve;}));curvePartitions.set(key,partition);}
  const witness=decodeExactPoint3(record.sample),cells=partition.cells.filter(c=>c.locate(witness)==='inside');
  if(cells.length!==1)throw new RangeError('Planar curve cell witness must select exactly one strict interior cell');
  const cell=cells[0]!,loop=cell.boundary.map(nativeBRepCurve3),boundary=record.orientation===1?loop:loop.reverse().map(reverseBRepCurve3);
  return Object.freeze({record,surface:Object.freeze({kind:'plane',plane:partition.base.surface}),sense:partition.base.sense*record.orientation as 1|-1,boundary:Object.freeze([Object.freeze(boundary)]),sample:cell.sample,locate:cell.locate});
 }
 if(record.kind==='cylinder-refined-cell'){
  const {sample:_sample,orientation:_orientation,...definition}=record,key=JSON.stringify(definition);let partition=refinedPartitions.get(key);if(!partition){const c=record.cutter;partition=partitionCylinderFaceByCylinder3(decodeCylinderDomain3(record.base),cylinder3(line3(decodeRationalPoint3(c.origin),decodeRationalPoint3(c.direction)),c.radiusSquared));for(const cut of record.cuts){const surface=decodeSurfaceRecord3(cut);if(surface.kind==='nurbs')throw new RangeError('Refined cylinder cells support only planes and circular cylinders');partition=refineCylinderFaceCells3(partition,surface);}refinedPartitions.set(key,partition);}
  const witness=decodeExactPoint3(record.sample),cells=partition.cells.filter(c=>c.locate(witness)==='inside');if(cells.length!==1)throw new RangeError('Refined cylinder witness must select exactly one strict interior cell');const cell=cells[0]!,boundary=record.orientation===1?cell.boundary:Object.freeze([...cell.boundary].reverse().map(reverseBRepCurve3));return Object.freeze({record,surface:Object.freeze({kind:'cylinder',cylinder:partition.base.surface}),sense:partition.base.sense*record.orientation as 1|-1,boundary:Object.freeze([boundary]),sample:cell.sample,locate:cell.locate});
 }

 if(record.kind==='planar-partition-cell'||record.kind==='planar-multi-partition-cell'){
  const {sample:_sample,orientation:_orientation,...definition}=record,key=JSON.stringify(definition);let partition=planarPartitions.get(key);if(!partition){const base=decodePlanarDomain3(record.base),cutters=(record.kind==='planar-partition-cell'?[record.cutter]:record.cutters).map(c=>cylinder3(line3(decodeRationalPoint3(c.origin),decodeRationalPoint3(c.direction)),c.radiusSquared));partition=partitionPlanarFaceByCylinders3(base,cutters,record.planes.map(p=>plane3(p.normal[0],p.normal[1],p.normal[2],p.offset)));planarPartitions.set(key,partition);}const base=partition.base,witness=decodeExactPoint3(record.sample),cells=partition.cells.filter(c=>c.locate(witness)==='inside');
  if(cells.length!==1)throw new RangeError('Planar cell witness must select exactly one strict interior cell');const cell=cells[0]!,loop=cell.boundary.map(nativeBRepCurve3),boundary=record.orientation===1?Object.freeze(loop):Object.freeze(loop.reverse().map(reverseBRepCurve3));
  return Object.freeze({record,surface:Object.freeze({kind:'plane',plane:base.surface}),sense:base.sense*record.orientation as 1|-1,boundary:Object.freeze([boundary]),sample:cell.sample,locate:cell.locate});
 }
 if(record.kind!=='cylinder-partition-cell'){const f=decodeFaceDomain3(record);return Object.freeze({...f,boundary:Object.freeze(f.boundary.map(loop=>Object.freeze(loop.map(nativeBRepCurve3))))});}
 const {sample:_sample,orientation:_orientation,...definition}=record,key=JSON.stringify(definition);let partition=cylinderPartitions.get(key);if(!partition){
 const b=record.base,a=decodeCurveRecord3(b.angular);if(a.kind!=='circular-arc')throw new RangeError('Cylinder angular domain must be a spatial circular arc');
 const base=prepareCylinderFace3(cylinder3(line3(decodeRationalPoint3(b.origin),decodeRationalPoint3(b.direction)),b.radiusSquared),b.lower,b.upper,{angular:a.arc,sense:b.sense}),c=record.cutter,cutter=cylinder3(line3(decodeRationalPoint3(c.origin),decodeRationalPoint3(c.direction)),c.radiusSquared);
 partition=partitionCylinderFaceByCylinder3(base,cutter);for(const p of record.planes)partition=partitionCylinderFaceCellsByPlane3(partition,plane3(p.normal[0],p.normal[1],p.normal[2],p.offset));cylinderPartitions.set(key,partition);}
 const base=partition.base;
 const witness=decodeExactPoint3(record.sample),cells=partition.cells.filter(c=>c.locate(witness)==='inside');if(cells.length!==1)throw new RangeError('Cylinder cell witness must select exactly one strict interior cell');
 const cell=cells[0]!,boundary=record.orientation===1?cell.boundary:Object.freeze([...cell.boundary].reverse().map(reverseBRepCurve3)),surface:Surface3=Object.freeze({kind:'cylinder',cylinder:base.surface});
 return Object.freeze({record,surface,sense:base.sense*record.orientation as 1|-1,boundary:Object.freeze([boundary]),sample:cell.sample,locate:cell.locate});
 };
}
