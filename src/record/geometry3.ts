import {realSchema3,pointSchema3,rationalPointSchema3} from './exact3.js';
import type {ExactRealRecord3,ExactPointRecord3,RationalPointRecord3} from './exact3.js';
import {objectSchema3,taggedSchema3,arraySchema3,literalSchema3,rationalSchema3,indexSchema3,booleanSchema3} from './schema.js';
import type {Schema3} from './schema.js';

export interface FrameRecord3 {readonly origin:RationalPointRecord3;readonly u:RationalPointRecord3;readonly v:RationalPointRecord3;}
export type CurveRecord3=
 | {readonly kind:'line';readonly origin:RationalPointRecord3;readonly direction:RationalPointRecord3;readonly start:ExactRealRecord3;readonly end:ExactRealRecord3}
 | {readonly kind:'segment';readonly start:ExactPointRecord3;readonly end:ExactPointRecord3}
 | {readonly kind:'circle';readonly center:RationalPointRecord3;readonly normal:RationalPointRecord3;readonly radiusSquared:string;readonly start:ExactPointRecord3;readonly end:ExactPointRecord3;readonly direction:'cw'|'ccw';readonly full:boolean}
 | {readonly kind:'ellipse';readonly frame:FrameRecord3;readonly radiusUSquared:string;readonly radiusVSquared:string;readonly start:ExactPointRecord3;readonly end:ExactPointRecord3;readonly direction:'cw'|'ccw';readonly full:boolean}
 | {readonly kind:'planar-circle';readonly frame:FrameRecord3;readonly center:readonly [string,string];readonly radiusSquared:string;readonly start:ExactPointRecord3;readonly end:ExactPointRecord3;readonly direction:'cw'|'ccw';readonly full:boolean}
 | {readonly kind:'nurbs';readonly degree:number;readonly points:readonly RationalPointRecord3[];readonly weights:readonly string[];readonly knots:readonly string[]};
export type SurfaceRecord3=
 | {readonly kind:'plane';readonly normal:RationalPointRecord3;readonly offset:string}
 | {readonly kind:'cylinder';readonly origin:RationalPointRecord3;readonly direction:RationalPointRecord3;readonly radiusSquared:string}
 | {readonly kind:'nurbs';readonly degreeU:number;readonly degreeV:number;readonly points:readonly (readonly RationalPointRecord3[])[];readonly weights:readonly (readonly string[])[];readonly knotsU:readonly string[];readonly knotsV:readonly string[]};
export const frameSchema3=objectSchema3({origin:rationalPointSchema3,u:rationalPointSchema3,v:rationalPointSchema3});
const rationalList=arraySchema3(rationalSchema3),arc={start:pointSchema3,end:pointSchema3,direction:literalSchema3('cw','ccw'),full:booleanSchema3};
export const curveSchema3:Schema3=taggedSchema3({
  line:objectSchema3({kind:literalSchema3('line'),origin:rationalPointSchema3,direction:rationalPointSchema3,start:realSchema3,end:realSchema3}),
  segment:objectSchema3({kind:literalSchema3('segment'),start:pointSchema3,end:pointSchema3}),
  circle:objectSchema3({kind:literalSchema3('circle'),center:rationalPointSchema3,normal:rationalPointSchema3,radiusSquared:rationalSchema3,...arc}),
  ellipse:objectSchema3({kind:literalSchema3('ellipse'),frame:frameSchema3,radiusUSquared:rationalSchema3,radiusVSquared:rationalSchema3,...arc}),
  'planar-circle':objectSchema3({kind:literalSchema3('planar-circle'),frame:frameSchema3,center:arraySchema3(rationalSchema3,2,2),radiusSquared:rationalSchema3,...arc}),
  nurbs:objectSchema3({kind:literalSchema3('nurbs'),degree:indexSchema3,points:arraySchema3(rationalPointSchema3),weights:rationalList,knots:rationalList}),
});
export const surfaceSchema3:Schema3=taggedSchema3({
  plane:objectSchema3({kind:literalSchema3('plane'),normal:rationalPointSchema3,offset:rationalSchema3}),
  cylinder:objectSchema3({kind:literalSchema3('cylinder'),origin:rationalPointSchema3,direction:rationalPointSchema3,radiusSquared:rationalSchema3}),
  nurbs:objectSchema3({kind:literalSchema3('nurbs'),degreeU:indexSchema3,degreeV:indexSchema3,points:arraySchema3(arraySchema3(rationalPointSchema3)),weights:arraySchema3(rationalList),knotsU:rationalList,knotsV:rationalList}),
});
