import {objectSchema3,taggedSchema3,arraySchema3,literalSchema3,rationalSchema3} from './schema.js';
import type {Schema3} from './schema.js';

export type ExactRealRecord3={readonly kind:'rational';readonly value:string}|{readonly kind:'root';readonly polynomial:readonly string[];readonly lower:string;readonly upper:string};
export type RationalPointRecord3=readonly [string,string,string];
export type ExactPointRecord3=
 | {readonly kind:'coordinates';readonly x:ExactRealRecord3;readonly y:ExactRealRecord3;readonly z:ExactRealRecord3}
 | {readonly kind:'affine';readonly origin:RationalPointRecord3;readonly direction:RationalPointRecord3;readonly parameter:ExactRealRecord3};
export const realSchema3:Schema3=taggedSchema3({rational:objectSchema3({kind:literalSchema3('rational'),value:rationalSchema3}),root:objectSchema3({kind:literalSchema3('root'),polynomial:arraySchema3(rationalSchema3,2),lower:rationalSchema3,upper:rationalSchema3})});
export const rationalPointSchema3=arraySchema3(rationalSchema3,3,3);
export const pointSchema3:Schema3=taggedSchema3({coordinates:objectSchema3({kind:literalSchema3('coordinates'),x:realSchema3,y:realSchema3,z:realSchema3}),affine:objectSchema3({kind:literalSchema3('affine'),origin:rationalPointSchema3,direction:rationalPointSchema3,parameter:realSchema3})});
