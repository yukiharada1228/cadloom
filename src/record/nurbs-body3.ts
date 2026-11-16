import {nurbsSourceBRepRecordSchema3} from './nurbs-source-brep3.js';
import type {NurbsSourceBRepRecord3} from './nurbs-source-brep3.js';
import {RecordReader3,objectSchema3,literalSchema3,arraySchema3,indexSchema3,rationalSchema3} from './schema.js';
import {rationalPointSchema3} from './exact3.js';
import type {RationalPointRecord3} from './exact3.js';
import type {RecordReadLimits3} from './schema.js';
/** Reconstructible source recipes and search hints, not geometric certificates. */
export interface NurbsBodyDocument3 {
 readonly version:1;readonly kind:'nurbs-body-document';
 readonly sources:readonly NurbsSourceBRepRecord3[];
 /** Optional untrusted search planes, fully rechecked during restoration. */
 readonly separators?:readonly Readonly<{first:number;second:number;normal:RationalPointRecord3;offset:string}>[];
}
const separator=objectSchema3({first:indexSchema3,second:indexSchema3,normal:rationalPointSchema3,offset:rationalSchema3});
const schema=objectSchema3({version:literalSchema3(1),kind:literalSchema3('nurbs-body-document'),sources:arraySchema3(nurbsSourceBRepRecordSchema3)},{separators:arraySchema3(separator)});
export function readNurbsBodyDocument3(input:unknown,limits:RecordReadLimits3={}):NurbsBodyDocument3 {
 return schema(input,'nurbsBody',new RecordReader3(limits)) as NurbsBodyDocument3;
}
