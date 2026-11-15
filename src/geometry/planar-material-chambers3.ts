import {Rational} from '../numeric/rational.js';
import {point3,cross3,dot3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3,evaluatePlane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {assertOwnedPlanarSolid3} from './planar-solid3.js';
import type {PreparedPlanarSolid3} from './planar-solid3.js';
import {line3,cylinder3} from './surface3.js';
import {prepareFiniteCylinder3} from './finite-cylinder-boolean3.js';
import type {FiniteCylinder3} from './finite-cylinder-boolean3.js';
import type {CylinderMaterialExpression3} from './cylinder-material-expression3.js';

export interface PlanarChamberProgram3 {
 readonly cylinders:readonly FiniteCylinder3[];
 readonly planes:readonly Plane3[];
 readonly expression:CylinderMaterialExpression3;
 readonly chambers:number;
 readonly materialChambers:number;
 readonly candidateVertices:number;
}
const axes=['x','y','z'] as const;
const zero=new Rational(0n),one=new Rational(1n);
const join=(kind:'intersection'|'union'|'difference',first:CylinderMaterialExpression3,second:CylinderMaterialExpression3):CylinderMaterialExpression3=>Object.freeze({kind,first,second});

/** Compile owned planar material using full-dimensional chambers of its physical
 * supporting planes and rational vertex box. Boundary semantics are regularized:
 * the returned predicates must pass complete material partitioning and sewing.
 * This does not certify a sewn boundary by itself. */
export function compilePlanarChambers3(source:PreparedPlanarSolid3):PlanarChamberProgram3 {
 assertOwnedPlanarSolid3(source);
 const vertices=source.polygons.flat();
 const extrema=(minimum:boolean):Point3=>vertices.length?point3(...axes.map(k=>vertices.reduce((a,p)=>(minimum?p[k].compare(a)<0:p[k].compare(a)>0)?p[k]:a,vertices[0]![k])) as Parameters<typeof point3>):point3(0n,0n,0n);
 const lo=extrema(true),hi=extrema(false),width=hi.x.sub(lo.x),depth=hi.y.sub(lo.y);
 const guard=prepareFiniteCylinder3(cylinder3(line3(point3(lo.x,lo.y,0n),point3(0n,0n,1n)),width.mul(width).add(depth.mul(depth)).add(one)),lo.z.sub(one),hi.z.add(one));
 const C:CylinderMaterialExpression3=Object.freeze({kind:'cylinder',cylinder:0}),F=join('difference',C,C);
 if(!vertices.length)return Object.freeze({cylinders:Object.freeze([guard]),planes:Object.freeze([]),expression:F,chambers:0,materialChambers:0,candidateVertices:0});
 if(axes.some(k=>lo[k].compare(hi[k])>=0))throw new Error('Nonempty planar material must have a full-dimensional vertex box');
 const planes:Plane3[]=[],ids=new Map<string,number>();
 const add=(input:Plane3)=>{
  const pivot=axes.map(k=>input.normal[k]).find(v=>v.sign()!==0)!,scale=one.div(pivot),p=plane3(input.normal.x.mul(scale),input.normal.y.mul(scale),input.normal.z.mul(scale),input.offset.mul(scale));
  const key=[p.normal.x,p.normal.y,p.normal.z,p.offset].map(v=>v.toString()).join(',');let id=ids.get(key);
  if(id===undefined){id=planes.length;ids.set(key,id);planes.push(p);}
  return {id,negative:pivot.sign()>0};
 };
 for(const face of source.topology.faces){if(face.surface.kind!=='plane')throw new Error('Planar material has a nonplanar support');add(face.surface.plane);}
 const bounds=axes.flatMap((k,i)=>{
  const normal=axes.map((_,j)=>i===j?one:zero) as [Rational,Rational,Rational];
  return [add(plane3(...normal,hi[k].neg())),add(plane3(normal[0].neg(),normal[1].neg(),normal[2].neg(),lo[k]))];
 });
 const H=(halfspace:number):CylinderMaterialExpression3=>Object.freeze({kind:'halfspace',halfspace});
 const points=new Map<string,Point3>();
 // Every vertex of every bounded chamber is an independent triple intersection.
 // Retaining additional arrangement vertices in a chamber is harmless: they
 // remain in its convex closure, and their average remains strictly interior.
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
  const a=planes[i]!,b=planes[j]!,d=planes[k]!,bc=cross3(b.normal,d.normal),ca=cross3(d.normal,a.normal),ab=cross3(a.normal,b.normal),det=dot3(a.normal,bc);
  if(det.sign()===0)continue;
  const p=point3(...axes.map(v=>a.offset.mul(bc[v]).add(b.offset.mul(ca[v])).add(d.offset.mul(ab[v])).neg().div(det)) as Parameters<typeof point3>);
  if(axes.every(v=>p[v].compare(lo[v])>=0&&p[v].compare(hi[v])<=0))points.set(axes.map(v=>p[v].toString()).join(','),p);
 }
 if(points.size<4)throw new Error('Full-dimensional chamber vertex enumeration failed');
 let chambers=0,materialChambers=0;
 const walk=(ps:readonly Point3[],i:number):CylinderMaterialExpression3=>{
  if(i===planes.length){
   const count=new Rational(BigInt(ps.length)),p=point3(...axes.map(k=>ps.reduce((sum,v)=>sum.add(v[k]),zero).div(count)) as Parameters<typeof point3>);
   if(planes.some(h=>evaluatePlane3(h,p).sign()===0))throw new Error('Chamber witness is not strictly interior');
   const location=source.locate(p);if(location==='boundary')throw new Error('Physical-plane chamber witness lies on source boundary');
   chambers++;if(location==='inside'){materialChambers++;return C;}return F;
  }
  const signs=ps.map(p=>evaluatePlane3(planes[i]!,p).sign()),negative=signs.some(s=>s<0),positive=signs.some(s=>s>0);
  if(!negative&&!positive)throw new Error('Full-dimensional chamber collapsed onto a carrier');
  if(!negative||!positive)return walk(ps,i+1);
  const a=walk(ps.filter((_,j)=>signs[j]!<=0),i+1),b=walk(ps.filter((_,j)=>signs[j]!>=0),i+1);
  if(a===b)return a;
  const h=H(i),opposite=join('difference',C,h);
  if(a===F)return join('intersection',opposite,b);
  if(b===F)return join('intersection',h,a);
  return join('union',join('intersection',h,a),join('intersection',opposite,b));
 };
 let expression=join('intersection',C,walk([...points.values()],0));
 for(const b of bounds)expression=join('intersection',b.negative?H(b.id):join('difference',C,H(b.id)),expression);
 return Object.freeze({cylinders:Object.freeze([guard]),planes:Object.freeze(planes),expression,chambers,materialChambers,candidateVertices:points.size});
}
