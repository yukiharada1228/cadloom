import {assertOwnedPlanarSolid3} from './planar-solid3.js';
import type {PreparedPlanarSolid3} from './planar-solid3.js';
import {point3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3,planeFromPoints,evaluatePlane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {line3,cylinder3} from './surface3.js';
import {prepareFiniteCylinder3} from './finite-cylinder-boolean3.js';
import type {FiniteCylinder3} from './finite-cylinder-boolean3.js';
import {Rational} from '../numeric/rational.js';
import type {CylinderMaterialExpression3} from './cylinder-material-expression3.js';
export interface PlanarMaterialProgram3 {
 readonly cylinders:readonly FiniteCylinder3[];
 readonly planes:readonly Plane3[];
 readonly expression:CylinderMaterialExpression3;
 readonly tetrahedra:number;
}
const leaf=(halfspace:number):CylinderMaterialExpression3=>Object.freeze({kind:'halfspace',halfspace});
const join=(kind:'intersection'|'xor'|'difference',first:CylinderMaterialExpression3,second:CylinderMaterialExpression3):CylinderMaterialExpression3=>Object.freeze({kind,first,second});
/** Compile an owned embedded polygonal material boundary to a bounded exact
 * parity program. This constructs predicates, not a sewn boundary certificate. */
export function compilePlanarMaterial3(source:PreparedPlanarSolid3):PlanarMaterialProgram3 {
 assertOwnedPlanarSolid3(source);
 const vertices=source.polygons.flat(),axes=['x','y','z'] as const,zero=point3(0n,0n),one=new Rational(1n),two=new Rational(2n);
 const extrema=(minimum:boolean):Point3=>vertices.length?point3(...axes.map(k=>vertices.reduce((a,p)=>(minimum?p[k].compare(a)<0:p[k].compare(a)>0)?p[k]:a,vertices[0]![k])) as Parameters<typeof point3>):zero;
 const lo=extrema(true),hi=extrema(false),apex=point3(lo.x.add(hi.x).div(two),lo.y.add(hi.y).div(two),lo.z.add(hi.z).div(two)),w=hi.x.sub(lo.x),d=hi.y.sub(lo.y),guard=prepareFiniteCylinder3(cylinder3(line3(point3(lo.x,lo.y,0n),point3(0n,0n,1n)),w.mul(w).add(d.mul(d)).add(one)),lo.z.sub(one),hi.z.add(one)),planes:Plane3[]=[],ids=new Map<string,number>(),terms:CylinderMaterialExpression3[]=[];
 const add=(input:Plane3)=>{const n=input.normal,pivot=[n.x,n.y,n.z].find(v=>v.sign()!==0)!,scale=one.div(pivot.sign()<0?pivot.neg():pivot),p=plane3(n.x.mul(scale),n.y.mul(scale),n.z.mul(scale),input.offset.mul(scale)),key=[p.normal.x,p.normal.y,p.normal.z,p.offset].map(v=>v.toString()).join(',');let id=ids.get(key);if(id===undefined){id=planes.length;planes.push(p);ids.set(key,id);}return leaf(id);};
 for(const triangle of source.triangles){
  if(evaluatePlane3(planeFromPoints(...triangle),apex).sign()===0)continue;
  const points=[apex,...triangle],faces=points.map((opposite,i)=>{const f=points.filter((_,j)=>i!==j),p=planeFromPoints(f[0]!,f[1]!,f[2]!);return add(evaluatePlane3(p,opposite).sign()<0?p:plane3(p.normal.x.neg(),p.normal.y.neg(),p.normal.z.neg(),p.offset.neg()));});
  terms.push(join('intersection',join('intersection',faces[0]!,faces[1]!),join('intersection',faces[2]!,faces[3]!)));
 }
 const count=terms.length,C:CylinderMaterialExpression3=Object.freeze({kind:'cylinder',cylinder:0});
 let level=terms;
 while(level.length>1){const next:CylinderMaterialExpression3[]=[];for(let i=0;i<level.length;i+=2)next.push(i+1<level.length?join('xor',level[i]!,level[i+1]!):level[i]!);level=next;}
 return Object.freeze({cylinders:Object.freeze([guard]),planes:Object.freeze(planes),expression:level.length?join('intersection',C,level[0]!):join('difference',C,C),tetrahedra:count});
}
