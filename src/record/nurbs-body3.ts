import {nurbsSourceBRepRecordSchema3} from './nurbs-source-brep3.js';
import type {NurbsSourceBRepRecord3} from './nurbs-source-brep3.js';
import {RecordReader3,objectSchema3,literalSchema3,arraySchema3} from './schema.js';
import type {RecordReadLimits3} from './schema.js';
/** Reconstructible source recipes only; no stored geometric certificates. */
export interface NurbsBodyDocument3 {
 readonly version:1;readonly kind:'nurbs-body-document';
 readonly sources:readonly NurbsSourceBRepRecord3[];
}
const schema=objectSchema3({version:literalSchema3(1),kind:literalSchema3('nurbs-body-document'),sources:arraySchema3(nurbsSourceBRepRecordSchema3)});
export function readNurbsBodyDocument3(input:unknown,limits:RecordReadLimits3={}):NurbsBodyDocument3 {
 return schema(input,'nurbsBody',new RecordReader3(limits)) as NurbsBodyDocument3;
}
