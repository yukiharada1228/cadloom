import {objectSchema3,taggedSchema3,arraySchema3,literalSchema3,rationalSchema3} from './schema.js';
import type {Schema3} from './schema.js';

export type ExactRealRecord3={readonly kind:'rational';readonly value:string}|{readonly kind:'root';readonly polynomial:readonly string[];readonly lower:string;readonly upper:string};
export type RationalPointRecord3=readonly [string,string,string];
export type ExactPointRecord3=
 | {readonly kind:'coordinates';readonly x:ExactRealRecord3;readonly y:ExactRealRecord3;readonly z:ExactRealRecord3}
 | {readonly kind:'affine';readonly origin:RationalPointRecord3;readonly direction:RationalPointRecord3;readonly parameter:ExactRealRecord3}
 | {readonly kind:'rational-map';readonly parameter:ExactRealRecord3;readonly numerators:readonly (readonly string[])[];readonly denominator:readonly string[]}
 | {readonly kind:'biparametric';readonly origin:RationalPointRecord3;readonly u:RationalPointRecord3;readonly s:ExactRealRecord3;readonly v:RationalPointRecord3;readonly t:ExactRealRecord3};
export const realSchema3:Schema3=taggedSchema3({rational:objectSchema3({kind:literalSchema3('rational'),value:rationalSchema3}),root:objectSchema3({kind:literalSchema3('root'),polynomial:arraySchema3(rationalSchema3,2),lower:rationalSchema3,upper:rationalSchema3})});
export const rationalPointSchema3=arraySchema3(rationalSchema3,3,3);
const polynomialSchema3=arraySchema3(rationalSchema3);
export const pointSchema3:Schema3=taggedSchema3({'rational-map':objectSchema3({kind:literalSchema3('rational-map'),parameter:realSchema3,numerators:arraySchema3(polynomialSchema3,3,3),denominator:polynomialSchema3}),biparametric:objectSchema3({kind:literalSchema3('biparametric'),origin:rationalPointSchema3,u:rationalPointSchema3,s:realSchema3,v:rationalPointSchema3,t:realSchema3}),coordinates:objectSchema3({kind:literalSchema3('coordinates'),x:realSchema3,y:realSchema3,z:realSchema3}),affine:objectSchema3({kind:literalSchema3('affine'),origin:rationalPointSchema3,direction:rationalPointSchema3,parameter:realSchema3})});
