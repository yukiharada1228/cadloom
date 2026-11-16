import {Rational} from '../numeric/rational.js';
import {point3,subtract3,cross3,dot3} from './point3.js';
import type {Point3} from './point3.js';
import {assertOwnedPlanarMaterialBoundary3} from './planar-solid-boolean3.js';
import type {PlanarSolidBooleanOperand3} from './planar-solid-boolean3.js';

type Row3=readonly [Rational,Rational,Rational];
export type RationalMatrix3=readonly [Row3,Row3,Row3];
export interface PlanarVolumeMoments3 {
 readonly volume:Rational;
 /** Geometric centroid of uniform material; null only for empty material. */
 readonly centroid:Point3|null;
 /** Integral of |x|² Id - x xᵀ, with unit density and world origin x=0. */
 readonly inertiaAtOrigin:RationalMatrix3;
 /** Same integral in centroid-relative coordinates, with unit density. */
 readonly inertiaAtCentroid:RationalMatrix3;
}
const axes=['x','y','z'] as const,zero=new Rational(0n),four=new Rational(4n),six=new Rational(6n),twenty=new Rational(20n);
const matrix=(entry:(i:number,j:number)=>Rational):RationalMatrix3=>{
 const row=(i:number):Row3=>Object.freeze<[Rational,Rational,Rational]>([entry(i,0),entry(i,1),entry(i,2)]);
 return Object.freeze<[Row3,Row3,Row3]>([row(0),row(1),row(2)]);
};
const inertia=(second:RationalMatrix3):RationalMatrix3=>{
 const trace=second[0][0].add(second[1][1]).add(second[2][2]);
 return matrix((i,j)=>i===j?trace.sub(second[i]![j]!):second[i]![j]!.neg());
};

/** Exact volume, centroid and unit-density inertia for owned rational planar
 * material, including cavities, islands and disconnected components. Surface
 * triangles are integrated as signed tetrahedra, not treated as a volume mesh.
 * Curved-body integration and density conversion are separate operations. */
export function planarVolumeMoments3(source:PlanarSolidBooleanOperand3):PlanarVolumeMoments3 {
 assertOwnedPlanarMaterialBoundary3(source);
 if(!source.triangles.length){const zeros=matrix(()=>zero);return Object.freeze({volume:zero,centroid:null,inertiaAtOrigin:zeros,inertiaAtCentroid:zeros});}
 // A nearby rational reference avoids large translation terms during the signed
 // accumulation. It need not be an interior point of any material component.
 const reference=source.triangles[0]![0],first=[zero,zero,zero],second=Array.from({length:3},()=>[zero,zero,zero]);let volume=zero;
 for(const triangle of source.triangles){
  const p=triangle.map(v=>subtract3(v,reference)),v=dot3(p[0]!,cross3(p[1]!,p[2]!)).div(six);if(v.sign()===0)continue;
  const sum=axes.map(k=>p[0]![k].add(p[1]![k]).add(p[2]![k]));volume=volume.add(v);
  for(let i=0;i<3;i++){
   first[i]=first[i]!.add(v.mul(sum[i]!).div(four));
   for(let j=0;j<3;j++){
    const diagonal=p.reduce((s,a)=>s.add(a[axes[i]!]!.mul(a[axes[j]!]!)),zero);
    second[i]![j]=second[i]![j]!.add(v.mul(sum[i]!.mul(sum[j]!).add(diagonal)).div(twenty));
   }
  }
 }
 if(volume.sign()<=0||!volume.equals(source.volume))throw new Error('Planar moment volume disagrees with the owned material certificate');
 const centroid=point3(...axes.map((k,i)=>reference[k].add(first[i]!.div(volume))) as Parameters<typeof point3>);
 const central=matrix((i,j)=>second[i]![j]!.sub(first[i]!.mul(first[j]!).div(volume)));
 const world=matrix((i,j)=>{
  const a=reference[axes[i]!],b=reference[axes[j]!];
  return second[i]![j]!.add(a.mul(first[j]!)).add(b.mul(first[i]!)).add(volume.mul(a).mul(b));
 });
 return Object.freeze({volume,centroid,inertiaAtOrigin:inertia(world),inertiaAtCentroid:inertia(central)});
}
