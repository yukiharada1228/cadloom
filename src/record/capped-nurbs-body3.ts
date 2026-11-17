import {nurbsBodyDocumentSchema3} from './nurbs-body3.js';
import type {NurbsBodyDocument3} from './nurbs-body3.js';
import {RecordReader3,objectSchema3,literalSchema3,rationalSchema3,directionSchema3} from './schema.js';
import type {RecordReadLimits3} from './schema.js';
import {rationalPointSchema3} from './exact3.js';
import type {RationalPointRecord3} from './exact3.js';
/** Untrusted construction recipe; no stored geometric certification flags. */
export interface CappedNurbsBodyDocument3 {
 readonly version:1;readonly kind:'capped-nurbs-body-document';readonly parent:NurbsBodyDocument3;
 readonly plane:Readonly<{normal:RationalPointRecord3;offset:string}>;readonly side:1|-1;
}
export const cappedNurbsBodyDocumentSchema3=objectSchema3({version:literalSchema3(1),kind:literalSchema3('capped-nurbs-body-document'),parent:nurbsBodyDocumentSchema3,plane:objectSchema3({normal:rationalPointSchema3,offset:rationalSchema3}),side:directionSchema3});
export function readCappedNurbsBodyDocument3(input:unknown,limits:RecordReadLimits3={}):CappedNurbsBodyDocument3 {return cappedNurbsBodyDocumentSchema3(input,'cappedNurbsBody',new RecordReader3(limits)) as CappedNurbsBodyDocument3;}
