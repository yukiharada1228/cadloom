import {objectSchema3,taggedSchema3,arraySchema3,literalSchema3,rationalSchema3,directionSchema3,RecordReader3} from './schema.js';
import type {Schema3,RecordReadLimits3} from './schema.js';
import {pointSchema3,rationalPointSchema3,realSchema3} from './exact3.js';
import type {ExactPointRecord3,ExactRealRecord3,RationalPointRecord3} from './exact3.js';
import {frameSchema3,curveSchema3} from './geometry3.js';
import type {CylinderSupportRecord3} from './brep-curve3.js';
import type {FrameRecord3,CurveRecord3} from './geometry3.js';

export interface CircleSupportRecord3 {readonly center:RationalPointRecord3;readonly normal:RationalPointRecord3;readonly radiusSquared:string;}
export interface EllipseSupportRecord3 {readonly frame:FrameRecord3;readonly radiusUSquared:string;readonly radiusVSquared:string;}
export type PlanarDomainRecord3=
 | {readonly kind:'chart';readonly frame:FrameRecord3;readonly rings:readonly (readonly CurveRecord3[])[];readonly sense:1|-1}
 | {readonly kind:'rectangle';readonly frame:FrameRecord3;readonly uMin:ExactRealRecord3;readonly uMax:ExactRealRecord3;readonly vMin:ExactRealRecord3;readonly vMax:ExactRealRecord3;readonly sense:1|-1}
 | {readonly kind:'circular';readonly outer:CircleSupportRecord3;readonly holes:readonly CircleSupportRecord3[];readonly sense:1|-1}
 | {readonly kind:'elliptic';readonly ellipse:EllipseSupportRecord3;readonly sense:1|-1};
export interface CylinderDomainRecord3 {
  readonly kind:'cylinder-product';readonly origin:RationalPointRecord3;readonly direction:RationalPointRecord3;
  readonly radiusSquared:string;readonly lower:string;readonly upper:string;readonly angular:CurveRecord3;readonly sense:1|-1;
}
export interface HalfSpaceRecord3 {readonly normal:RationalPointRecord3;readonly offset:string;readonly side:1|-1;}
export interface CylinderCellDomainRecord3 {readonly kind:'cylinder-partition-cell';readonly base:CylinderDomainRecord3;readonly cutter:CylinderSupportRecord3;readonly planes:readonly {readonly normal:RationalPointRecord3;readonly offset:string}[];readonly sample:ExactPointRecord3;readonly orientation:1|-1;}
export type FaceDomainRecord3=PlanarDomainRecord3|CylinderDomainRecord3|CylinderCellDomainRecord3
 | {readonly kind:'trimmed-planar';readonly base:PlanarDomainRecord3;readonly halfspaces:readonly HalfSpaceRecord3[];/** Strict interior point selects a recomputed component, not an unchecked ID. */readonly sample:ExactPointRecord3}
 | {readonly kind:'trimmed-cylinder';readonly base:CylinderDomainRecord3;readonly halfspaces:readonly HalfSpaceRecord3[];readonly sample:ExactPointRecord3};
const circle=objectSchema3({center:rationalPointSchema3,normal:rationalPointSchema3,radiusSquared:rationalSchema3}),ellipse=objectSchema3({frame:frameSchema3,radiusUSquared:rationalSchema3,radiusVSquared:rationalSchema3});
export const planarDomainSchema3:Schema3=taggedSchema3({
  chart:objectSchema3({kind:literalSchema3('chart'),frame:frameSchema3,rings:arraySchema3(arraySchema3(curveSchema3,1)),sense:directionSchema3}),
  rectangle:objectSchema3({kind:literalSchema3('rectangle'),frame:frameSchema3,uMin:realSchema3,uMax:realSchema3,vMin:realSchema3,vMax:realSchema3,sense:directionSchema3}),
  circular:objectSchema3({kind:literalSchema3('circular'),outer:circle,holes:arraySchema3(circle),sense:directionSchema3}),
  elliptic:objectSchema3({kind:literalSchema3('elliptic'),ellipse,sense:directionSchema3}),
});
export const cylinderDomainSchema3:Schema3=objectSchema3({kind:literalSchema3('cylinder-product'),origin:rationalPointSchema3,direction:rationalPointSchema3,radiusSquared:rationalSchema3,lower:rationalSchema3,upper:rationalSchema3,angular:curveSchema3,sense:directionSchema3});
const halfspaces=arraySchema3(objectSchema3({normal:rationalPointSchema3,offset:rationalSchema3,side:directionSchema3}));
export const faceDomainSchema3:Schema3=(v,p,r)=>{
  if(v!==null&&typeof v==='object'&&Object.hasOwn(v,'kind')){
    const kind=(v as {kind:unknown}).kind;
    if(kind==='cylinder-partition-cell')return objectSchema3({kind:literalSchema3('cylinder-partition-cell'),base:cylinderDomainSchema3,cutter:objectSchema3({origin:rationalPointSchema3,direction:rationalPointSchema3,radiusSquared:rationalSchema3}),planes:arraySchema3(objectSchema3({normal:rationalPointSchema3,offset:rationalSchema3})),sample:pointSchema3,orientation:directionSchema3})(v,p,r);
    if(kind==='cylinder-product')return cylinderDomainSchema3(v,p,r);
    if(kind==='trimmed-planar')return objectSchema3({kind:literalSchema3('trimmed-planar'),base:planarDomainSchema3,halfspaces,sample:pointSchema3})(v,p,r);
    if(kind==='trimmed-cylinder')return objectSchema3({kind:literalSchema3('trimmed-cylinder'),base:cylinderDomainSchema3,halfspaces,sample:pointSchema3})(v,p,r);
  }
  return planarDomainSchema3(v,p,r);
};
export function readFaceDomainRecord3(input:unknown,limits:RecordReadLimits3={}):FaceDomainRecord3 {return faceDomainSchema3(input,'domain',new RecordReader3(limits)) as FaceDomainRecord3;}
