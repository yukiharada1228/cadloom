import {point3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {line3} from './surface3.js';
import type {SewnNurbsSourceBReps3} from './sew-nurbs-source-breps3.js';
import {intersectSewnNurbsSourceRay3,querySewnNurbsSourceShellParity3} from './sewn-nurbs-source-ray3.js';
import type {SewnNurbsShellParity3} from './sewn-nurbs-source-ray3.js';

export interface SewnNurbsParitySearchOptions3 {
 readonly maxDirections?:number;
 /** Tried first; positive scalar multiples count as one direction. */
 readonly directions?:readonly Vector3[];
}
export type SewnNurbsShellParitySearch3 =
 | (Exclude<SewnNurbsShellParity3,{kind:'retry'}> & Readonly<{attempts:number}>)
 | Readonly<{kind:'unresolved';reason:'ray-budget';attempts:number;lastRay:Extract<SewnNurbsShellParity3,{kind:'retry'}>['ray']}>;

function canonical(direction:Vector3):Vector3 {
 const d=point3(direction.x,direction.y,direction.z);
 const first=[d.x,d.y,d.z].find(q=>q.sign()!==0);
 if(!first)throw new RangeError('Ray direction must be nonzero');
 const scale=first.sign()<0?first.neg():first;
 return point3(d.x.div(scale),d.y.div(scale),d.z.div(scale));
}
function* candidates(preferred:readonly Vector3[]):Generator<Vector3> {
 yield* preferred;
 yield point3(1n,0n,0n);yield point3(0n,1n,0n);yield point3(0n,0n,1n);
 // Every rational direction has an integer representative. BigInt avoids a
 // floating-point enumeration limit; opposite rays remain distinct.
 for(let r=1n;;r++)for(let x=-r;x<=r;x++)for(let y=-r;y<=r;y++)for(let z=-r;z<=r;z++){
  if(x!==-r&&x!==r&&y!==-r&&y!==r&&z!==-r&&z!==r)continue;
  yield point3(x,y,z);
 }
}
/** Internal shared exact enumeration; not part of the package API. */
export function* sewnNurbsRayDirections3(preferred:readonly Vector3[]):Generator<Vector3> {
 const snapshot=preferred.map(canonical),seen=new Set<string>();
 for(const candidate of candidates(snapshot)){
  const direction=canonical(candidate),key=[direction.x,direction.y,direction.z].map(q=>q.toString()).join(',');
  if(seen.has(key))continue;seen.add(key);yield direction;
 }
}
/** Exact retry of degenerate rays. Exhausting a finite budget never means
 * outside. Like the single-ray API, this is not a global embedding proof. */
export function querySewnNurbsSourceShellParityAuto3(input:SewnNurbsSourceBReps3,shell:number,origin:Point3,options:SewnNurbsParitySearchOptions3={}):SewnNurbsShellParitySearch3 {
 const budget=options.maxDirections??128;
 if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');
 // Snapshot and validate all caller directions before any geometric query.
 let attempts=0,lastRay:Extract<SewnNurbsShellParity3,{kind:'retry'}>['ray']|undefined;
 for(const direction of sewnNurbsRayDirections3(options.directions??[])){
  attempts++;
  if(attempts===1){
   const q=querySewnNurbsSourceShellParity3(input,shell,origin,direction);
   if(q.kind!=='retry')return Object.freeze({...q,attempts});
   lastRay=q.ray;
  }else{
   // The first query established that origin is off every selected face.
   const ray=intersectSewnNurbsSourceRay3(input,line3(origin,direction),shell);
   if(ray.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:ray.reason,attempts});
   if(ray.kind==='regular'){
    const crossings=ray.hits.length,orientedSum=ray.hits.reduce((sum,h)=>sum+h.uses[0]!.normals[0]!.dotSign,0);
    return Object.freeze({kind:'parity',parity:crossings%2?'odd':'even',crossings,orientedSum,ray,attempts});
   }
   lastRay=ray;
  }
  if(attempts===budget)return Object.freeze({kind:'unresolved',reason:'ray-budget',attempts,lastRay:lastRay!});
 }
 throw new Error('Infinite ray direction enumeration terminated');
}
