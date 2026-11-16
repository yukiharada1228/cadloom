import {point3,dot3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import type {Rational} from '../numeric/rational.js';
/** Exact rational similarity p -> Lp+t; columns of L are orthogonal and
 * have the same nonzero squared length. Reflections are supported. */
export interface SimilarityTransform3 {
 readonly columns:readonly [Vector3,Vector3,Vector3];readonly translation:Point3;readonly scaleSquared:Rational;
}
const owned=new WeakSet<SimilarityTransform3>();
export function similarityTransform3(input:readonly [Vector3,Vector3,Vector3],translation:Point3=point3(0n,0n,0n)):SimilarityTransform3 {
 const columns=Object.freeze(input.map(v=>point3(v.x,v.y,v.z))) as readonly [Vector3,Vector3,Vector3];
 if(columns.length!==3)throw new RangeError('A similarity requires three matrix columns');
 const scaleSquared=dot3(columns[0],columns[0]);
 if(scaleSquared.sign()<=0||!dot3(columns[1],columns[1]).equals(scaleSquared)||!dot3(columns[2],columns[2]).equals(scaleSquared)||dot3(columns[0],columns[1]).sign()!==0||dot3(columns[0],columns[2]).sign()!==0||dot3(columns[1],columns[2]).sign()!==0)throw new RangeError('Matrix must be a nonzero exact similarity');
 const result=Object.freeze({columns,translation:point3(translation.x,translation.y,translation.z),scaleSquared});owned.add(result);return result;
}
export function assertOwnedSimilarityTransform3(input:SimilarityTransform3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created similarity transform');}
export function transformVectorBySimilarity3(transform:SimilarityTransform3,input:Vector3):Vector3 {
 assertOwnedSimilarityTransform3(transform);const v=point3(input.x,input.y,input.z),[a,b,c]=transform.columns;
 return point3(a.x.mul(v.x).add(b.x.mul(v.y)).add(c.x.mul(v.z)),a.y.mul(v.x).add(b.y.mul(v.y)).add(c.y.mul(v.z)),a.z.mul(v.x).add(b.z.mul(v.y)).add(c.z.mul(v.z)));
}
export function transformPointBySimilarity3(transform:SimilarityTransform3,input:Point3):Point3 {
 const p=transformVectorBySimilarity3(transform,input),t=transform.translation;return point3(p.x.add(t.x),p.y.add(t.y),p.z.add(t.z));
}
