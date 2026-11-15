import {bodySchema3,readBodyRecord3} from './body3.js';
import type {BodyRecord3} from './body3.js';
import {curveSchema3} from './geometry3.js';
import type {CurveRecord3} from './geometry3.js';
import {rationalPointSchema3} from './exact3.js';
import type {RationalPointRecord3} from './exact3.js';
import {RecordReader3,objectSchema3,taggedSchema3,literalSchema3,arraySchema3,rationalSchema3} from './schema.js';
import type {RecordReadLimits3} from './schema.js';

export type BodyConstructionRecord3=
 | {readonly kind:'box';readonly origin:RationalPointRecord3;readonly size:RationalPointRecord3}
 | {readonly kind:'cylinder';readonly origin:RationalPointRecord3;readonly direction:RationalPointRecord3;readonly radiusSquared:string;readonly lower:string;readonly upper:string}
 | {readonly kind:'extrude';readonly profile:readonly (readonly CurveRecord3[])[];readonly lower:string;readonly upper:string};
export interface BodyDocument3 {readonly version:1;readonly construction:BodyConstructionRecord3;readonly body:BodyRecord3;}
export const constructionSchema3=taggedSchema3({
  box:objectSchema3({kind:literalSchema3('box'),origin:rationalPointSchema3,size:rationalPointSchema3}),
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
