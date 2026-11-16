import {curveSchema3,surfaceSchema3} from './geometry3.js';
import type {CurveRecord3,SurfaceRecord3} from './geometry3.js';
import {RecordReader3,objectSchema3,literalSchema3,arraySchema3,directionSchema3,recordError3} from './schema.js';
import type {Schema3,RecordReadLimits3} from './schema.js';
export interface NurbsSourceDomainRecord3 {
 readonly outer:readonly Extract<CurveRecord3,{kind:'nurbs'}>[];
 readonly holes:readonly (readonly Extract<CurveRecord3,{kind:'nurbs'}>[])[];readonly sense:1|-1;
}
/** Construction inputs only: no persisted proof, ownership or topology claim. */
export interface NurbsSourceBRepRecord3 {
 readonly version:1;readonly kind:'nurbs-source-brep';
 readonly source:Extract<SurfaceRecord3,{kind:'nurbs'}>;readonly target:Extract<SurfaceRecord3,{kind:'nurbs'}>;
 readonly sourceDomain:NurbsSourceDomainRecord3;readonly targetDomain:NurbsSourceDomainRecord3;readonly sense:1|-1;
}
const curve:Schema3=(v,p,r)=>{const c=curveSchema3(v,p,r) as CurveRecord3;if(c.kind!=='nurbs')recordError3(p,'expected a NURBS parameter curve');return c;};
const surface:Schema3=(v,p,r)=>{const s=surfaceSchema3(v,p,r) as SurfaceRecord3;if(s.kind!=='nurbs')recordError3(p,'expected a NURBS surface');return s;};
const domain=objectSchema3({outer:arraySchema3(curve,1),holes:arraySchema3(arraySchema3(curve,1)),sense:directionSchema3});
export const nurbsSourceBRepRecordSchema3=objectSchema3({version:literalSchema3(1),kind:literalSchema3('nurbs-source-brep'),source:surface,target:surface,sourceDomain:domain,targetDomain:domain,sense:directionSchema3});
const schema=nurbsSourceBRepRecordSchema3;
export function readNurbsSourceBRepRecord3(input:unknown,limits:RecordReadLimits3={}):NurbsSourceBRepRecord3 {return schema(input,'sourceBRep',new RecordReader3(limits)) as NurbsSourceBRepRecord3;}
export function parseNurbsSourceBRepRecord3(json:string,limits:RecordReadLimits3={}):NurbsSourceBRepRecord3 {
 const r=new RecordReader3(limits);if(typeof json!=='string'||json.length>r.maxNumericCharacters+r.maxItems*64)throw new RangeError('NURBS source BRep text budget exceeded');return readNurbsSourceBRepRecord3(JSON.parse(json),limits);
}
