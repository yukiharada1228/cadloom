import {cappedNurbsBodyDocumentSchema3} from './capped-nurbs-body3.js';
import type {CappedNurbsBodyDocument3} from './capped-nurbs-body3.js';
import {RecordReader3,objectSchema3,literalSchema3,rationalSchema3,directionSchema3} from './schema.js';
import type {RecordReadLimits3} from './schema.js';
import {rationalPointSchema3} from './exact3.js';
import type {RationalPointRecord3} from './exact3.js';
/** Source-only two-cut recipe; no persisted geometric certification flags. */
export interface RecutNurbsBodyDocument3 {
 readonly version:1;readonly kind:'recut-nurbs-body-document';readonly parent:CappedNurbsBodyDocument3;
 readonly plane:Readonly<{normal:RationalPointRecord3;offset:string}>;readonly side:1|-1;
}
const schema=objectSchema3({version:literalSchema3(1),kind:literalSchema3('recut-nurbs-body-document'),parent:cappedNurbsBodyDocumentSchema3,plane:objectSchema3({normal:rationalPointSchema3,offset:rationalSchema3}),side:directionSchema3});
export function readRecutNurbsBodyDocument3(input:unknown,limits:RecordReadLimits3={}):RecutNurbsBodyDocument3 {return schema(input,'recutNurbsBody',new RecordReader3(limits)) as RecutNurbsBodyDocument3;}
