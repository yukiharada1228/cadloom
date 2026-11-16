import {point3,cross3,dot3,subtract3,pointsEqual3,segment3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3} from './plane3.js';
import type {Rational} from '../numeric/rational.js';
import {assertOwnedPlanarSolid3} from './planar-solid3.js';
import type {PreparedPlanarSolid3} from './planar-solid3.js';
import {closestPointOnSegment3,closestPointOnSurface3} from './closest-point3.js';
export type PlanarBoundaryClosest3=
 | {readonly kind:'empty'}
 | {readonly kind:'points';readonly points:readonly Point3[];readonly squaredDistance:Rational};
/** Exact nearest points on the finite boundary, including cavity shells.
 * Rational convex face pieces are an exact decomposition, not an approximate mesh. */
export function closestPointOnPlanarSolidBoundary3(source:PreparedPlanarSolid3,input:Point3):PlanarBoundaryClosest3 {
 assertOwnedPlanarSolid3(source);const p=point3(input.x,input.y,input.z);let best:Rational|undefined,points:Point3[]=[];
 const add=(q:Point3,d:Rational)=>{const order=best===undefined?-1:d.compare(best);if(order<0){best=d;points=[q];}else if(order===0&&!points.some(v=>pointsEqual3(v,q)))points.push(q);};
 for(const polygon of source.polygons){
  const origin=polygon[0]!,normal=polygon.reduce((sum,a,i)=>{const n=cross3(subtract3(a,origin),subtract3(polygon[(i+1)%polygon.length]!,origin));return point3(sum.x.add(n.x),sum.y.add(n.y),sum.z.add(n.z));},point3(0n,0n,0n)),plane=plane3(normal.x,normal.y,normal.z,dot3(normal,origin).neg()),projection=closestPointOnSurface3(p,{kind:'plane',plane});
  if(projection.kind!=='point'||projection.point.x.rational===null||projection.point.y.rational===null||projection.point.z.rational===null||projection.squaredDistance.rational===null)throw new Error('Rational planar projection lost its exact rational representation');
  const q=point3(projection.point.x.rational,projection.point.y.rational,projection.point.z.rational),inside=polygon.every((a,i)=>dot3(normal,cross3(subtract3(polygon[(i+1)%polygon.length]!,a),subtract3(q,a))).sign()>=0);
  if(inside){add(q,projection.squaredDistance.rational);continue;}
  polygon.forEach((a,i)=>{
   const nearest=closestPointOnSegment3(p,segment3(a,polygon[(i+1)%polygon.length]!)),v=nearest.point,d=nearest.squaredDistance.rational;
   if(v.x.rational===null||v.y.rational===null||v.z.rational===null||d===null)throw new Error('Rational planar edge projection lost its exact representation');
   add(point3(v.x.rational,v.y.rational,v.z.rational),d);
  });
 }
 if(best===undefined)return Object.freeze({kind:'empty'});
 points.sort((a,b)=>a.x.compare(b.x)||a.y.compare(b.y)||a.z.compare(b.z));
 return Object.freeze({kind:'points',points:Object.freeze(points),squaredDistance:best});
}
