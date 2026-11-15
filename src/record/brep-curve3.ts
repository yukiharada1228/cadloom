import type {CurveRecord3} from './geometry3.js';
import {curveSchema3} from './geometry3.js';
import type {ExactPointRecord3,RationalPointRecord3} from './exact3.js';
import {pointSchema3,rationalPointSchema3} from './exact3.js';
import {objectSchema3,taggedSchema3,literalSchema3,directionSchema3,rationalSchema3} from './schema.js';
export interface CylinderSupportRecord3 {readonly origin:RationalPointRecord3;readonly direction:RationalPointRecord3;readonly radiusSquared:string;}
export type BRepCurveRecord3=
 | {readonly kind:'native';readonly curve:CurveRecord3}
 | {readonly kind:'cylinder-ssi';readonly first:CylinderSupportRecord3;readonly second:CylinderSupportRecord3;readonly baseStart:ExactPointRecord3;readonly baseEnd:ExactPointRecord3;readonly branch:1|-1;readonly direction:1|-1};
const cylinderSchema3=objectSchema3({origin:rationalPointSchema3,direction:rationalPointSchema3,radiusSquared:rationalSchema3});
export const brepCurveSchema3=taggedSchema3({native:objectSchema3({kind:literalSchema3('native'),curve:curveSchema3}),'cylinder-ssi':objectSchema3({kind:literalSchema3('cylinder-ssi'),first:cylinderSchema3,second:cylinderSchema3,baseStart:pointSchema3,baseEnd:pointSchema3,branch:directionSchema3,direction:directionSchema3})});
