import {curveSchema3,surfaceSchema3} from './geometry3.js';
import type {CurveRecord3,SurfaceRecord3} from './geometry3.js';
import {RecordReader3,objectSchema3,literalSchema3,arraySchema3,directionSchema3,recordError3} from './schema.js';
import type {Schema3,RecordReadLimits3} from './schema.js';
export interface AffineNurbsFaceRecord3 {
 readonly version:1;readonly kind:'affine-nurbs-face';
 readonly surface:Extract<SurfaceRecord3,{kind:'nurbs'}>;
 readonly outer:readonly Extract<CurveRecord3,{kind:'nurbs'}>[];
 readonly holes:readonly (readonly Extract<CurveRecord3,{kind:'nurbs'}>[])[];
 readonly sense:1|-1;
}
export interface AffineNurbsFacesDocument3 {readonly version:1;readonly kind:'affine-nurbs-faces';readonly faces:readonly AffineNurbsFaceRecord3[];}
const curve:Schema3=(v,p,r)=>{const c=curveSchema3(v,p,r) as CurveRecord3;if(c.kind!=='nurbs')recordError3(p,'expected a NURBS parameter curve');return c;};
const surface:Schema3=(v,p,r)=>{const s=surfaceSchema3(v,p,r) as SurfaceRecord3;if(s.kind!=='nurbs')recordError3(p,'expected a NURBS surface');return s;};
const faceSchema=objectSchema3({version:literalSchema3(1),kind:literalSchema3('affine-nurbs-face'),surface,outer:arraySchema3(curve,1),holes:arraySchema3(arraySchema3(curve,1)),sense:directionSchema3});
const documentSchema=objectSchema3({version:literalSchema3(1),kind:literalSchema3('affine-nurbs-faces'),faces:arraySchema3(faceSchema)});
/** Structural snapshots only. Geometry and embedding must be reconstructed. */
export function readAffineNurbsFaceRecord3(input:unknown,limits:RecordReadLimits3={}):AffineNurbsFaceRecord3 {return faceSchema(input,'face',new RecordReader3(limits)) as AffineNurbsFaceRecord3;}
export function readAffineNurbsFacesDocument3(input:unknown,limits:RecordReadLimits3={}):AffineNurbsFacesDocument3 {return documentSchema(input,'document',new RecordReader3(limits)) as AffineNurbsFacesDocument3;}
export function parseAffineNurbsFacesDocument3(json:string,limits:RecordReadLimits3={}):AffineNurbsFacesDocument3 {
 const reader=new RecordReader3(limits);if(typeof json!=='string'||json.length>reader.maxNumericCharacters+reader.maxItems*64)throw new RangeError('NURBS face document text budget exceeded');return readAffineNurbsFacesDocument3(JSON.parse(json),limits);
}
