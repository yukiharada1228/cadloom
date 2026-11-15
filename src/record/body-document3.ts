import type {FiniteCylinderExpression3} from '../geometry/finite-cylinder-expression3.js';
import type {Schema3} from './schema.js';
import type {HalfSpaceRecord3} from './face-domain3.js';
import {bodySchema3,readBodyRecord3} from './body3.js';
import type {BodyRecord3} from './body3.js';
import {curveSchema3} from './geometry3.js';
import type {CurveRecord3} from './geometry3.js';
import {rationalPointSchema3} from './exact3.js';
import type {RationalPointRecord3} from './exact3.js';
import {RecordReader3,objectSchema3,taggedSchema3,literalSchema3,arraySchema3,rationalSchema3,directionSchema3,indexSchema3} from './schema.js';
import type {RecordReadLimits3} from './schema.js';

export interface FiniteCylinderConstructionRecord3 {readonly origin:RationalPointRecord3;readonly direction:RationalPointRecord3;readonly radiusSquared:string;readonly lower:string;readonly upper:string;}
export type BodyConstructionRecord3=
 | {readonly kind:'clipped-cylinder-expression';readonly operands:readonly FiniteCylinderConstructionRecord3[];readonly expression:FiniteCylinderExpression3;readonly halfspaces:readonly HalfSpaceRecord3[]}
 | {readonly kind:'plane-cut-cylinder-expression';readonly operands:readonly FiniteCylinderConstructionRecord3[];readonly expression:FiniteCylinderExpression3;readonly cut:HalfSpaceRecord3}
 | {readonly kind:'finite-cylinder-expression';readonly operands:readonly FiniteCylinderConstructionRecord3[];readonly expression:FiniteCylinderExpression3}
 | {readonly kind:'finite-cylinder-boolean';readonly first:FiniteCylinderConstructionRecord3;readonly second:FiniteCylinderConstructionRecord3;readonly operation:'union'|'intersection'|'difference'|'xor'}
 | {readonly kind:'box';readonly origin:RationalPointRecord3;readonly size:RationalPointRecord3}
 | {readonly kind:'clipped-cylinder';readonly origin:RationalPointRecord3;readonly direction:RationalPointRecord3;readonly radiusSquared:string;readonly lower:string;readonly upper:string;readonly halfspaces:readonly HalfSpaceRecord3[]}
 | {readonly kind:'cylinder';readonly origin:RationalPointRecord3;readonly direction:RationalPointRecord3;readonly radiusSquared:string;readonly lower:string;readonly upper:string}
 | {readonly kind:'planar-consolidated';readonly polygons:readonly (readonly RationalPointRecord3[])[]}
 | {readonly kind:'planar';readonly polygons:readonly (readonly RationalPointRecord3[])[]}
 | {readonly kind:'extrude';readonly profile:readonly (readonly CurveRecord3[])[];readonly lower:string;readonly upper:string};
export interface BodyDocument3 {readonly version:1;readonly construction:BodyConstructionRecord3;readonly body:BodyRecord3;}
const finiteCylinderSchema3=objectSchema3({origin:rationalPointSchema3,direction:rationalPointSchema3,radiusSquared:rationalSchema3,lower:rationalSchema3,upper:rationalSchema3});
const cylinderExpressionSchema3:Schema3=(value,path,reader)=>{
 const active=new Set<object>();const read:Schema3=(v,p,r)=>{if(v!==null&&typeof v==='object'){if(active.has(v))throw new RangeError('Cyclic cylinder expression record');active.add(v);}const child=objectSchema3({kind:literalSchema3('union','intersection','difference','xor'),first:read,second:read}),result=taggedSchema3({operand:objectSchema3({kind:literalSchema3('operand'),operand:indexSchema3}),union:child,intersection:child,difference:child,xor:child})(v,p,r);if(v!==null&&typeof v==='object')active.delete(v);return result;};return read(value,path,reader);
};
export const constructionSchema3=taggedSchema3({
  'clipped-cylinder-expression':objectSchema3({kind:literalSchema3('clipped-cylinder-expression'),operands:arraySchema3(finiteCylinderSchema3,1),expression:cylinderExpressionSchema3,halfspaces:arraySchema3(objectSchema3({normal:rationalPointSchema3,offset:rationalSchema3,side:directionSchema3}))}),
  'plane-cut-cylinder-expression':objectSchema3({kind:literalSchema3('plane-cut-cylinder-expression'),operands:arraySchema3(finiteCylinderSchema3,1),expression:cylinderExpressionSchema3,cut:objectSchema3({normal:rationalPointSchema3,offset:rationalSchema3,side:directionSchema3})}),
  'finite-cylinder-expression':objectSchema3({kind:literalSchema3('finite-cylinder-expression'),operands:arraySchema3(finiteCylinderSchema3,1),expression:cylinderExpressionSchema3}),
  'finite-cylinder-boolean':objectSchema3({kind:literalSchema3('finite-cylinder-boolean'),first:finiteCylinderSchema3,second:finiteCylinderSchema3,operation:literalSchema3('union','intersection','difference','xor')}),
  'planar-consolidated':objectSchema3({kind:literalSchema3('planar-consolidated'),polygons:arraySchema3(arraySchema3(rationalPointSchema3,3))}),
  planar:objectSchema3({kind:literalSchema3('planar'),polygons:arraySchema3(arraySchema3(rationalPointSchema3,3))}),
  box:objectSchema3({kind:literalSchema3('box'),origin:rationalPointSchema3,size:rationalPointSchema3}),
  'clipped-cylinder':objectSchema3({kind:literalSchema3('clipped-cylinder'),origin:rationalPointSchema3,direction:rationalPointSchema3,radiusSquared:rationalSchema3,lower:rationalSchema3,upper:rationalSchema3,halfspaces:arraySchema3(objectSchema3({normal:rationalPointSchema3,offset:rationalSchema3,side:directionSchema3}))}),
  cylinder:objectSchema3({kind:literalSchema3('cylinder'),origin:rationalPointSchema3,direction:rationalPointSchema3,radiusSquared:rationalSchema3,lower:rationalSchema3,upper:rationalSchema3}),
  extrude:objectSchema3({kind:literalSchema3('extrude'),profile:arraySchema3(arraySchema3(curveSchema3,1)),lower:rationalSchema3,upper:rationalSchema3}),
});
const documentSchema=objectSchema3({version:literalSchema3(1),construction:constructionSchema3,body:bodySchema3});
/** Structural snapshot only. A recipe is not an accepted geometry certificate. */
export function readBodyDocument3(input:unknown,limits:RecordReadLimits3={}):BodyDocument3 {
  const d=documentSchema(input,'document',new RecordReader3(limits)) as unknown as BodyDocument3;return Object.freeze({version:1,construction:d.construction,body:readBodyRecord3(d.body,limits)});
}
export function parseBodyDocument3(json:string,limits:RecordReadLimits3={}):BodyDocument3 {
  const r=new RecordReader3(limits);if(typeof json!=='string'||json.length>r.maxNumericCharacters+r.maxItems*64)throw new RangeError('Body document text budget exceeded');return readBodyDocument3(JSON.parse(json),limits);
}
