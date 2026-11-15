import {Rational} from '../numeric/rational.js';
import {point3,cross3,dot3,subtract3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3,planeFromPoints,evaluatePlane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {snapshotExactPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {classifyPointToSurface3} from './surface3.js';
import type {Triangle3} from './triangle3.js';
import {createSurfaceLocator3} from './surface-location3.js';
/** Internal exact extension of certified rational planar material queries to
 * arbitrary real algebraic coordinates. Select a rational representative of the
 * same support/edge-plane sign cell; preserve all zero equalities via rational
 * elimination, and refine free coordinates until every strict sign agrees.
 */
export function createExactPlanarLocator3(triangles:readonly Triangle3[]){
  const rationalLocate=createSurfaceLocator3(triangles),map=new Map<string,Plane3>();
  function add(p:Plane3){const n=p.normal,k=[n.x,n.y,n.z].find(v=>v.sign()!==0)!,q=plane3(n.x.div(k),n.y.div(k),n.z.div(k),p.offset.div(k));map.set(`${q.normal.x},${q.normal.y},${q.normal.z},${q.offset}`,q);}
  for(const t of triangles){const support=planeFromPoints(...t);add(support);t.forEach((a,i)=>{const n=cross3(subtract3(t[(i+1)%3]!,a),support.normal);add(plane3(n.x,n.y,n.z,dot3(n,a).neg()));});}
  const planes=[...map.values()],two=new Rational(2n),axes=['x','y','z'] as const;
  return (input:Point3|AlgebraicCoordinates3)=>{
    const p=snapshotExactPoint3(input);
    if(axes.every(k=>p[k].rational!==null))return rationalLocate(point3(p.x.rational!,p.y.rational!,p.z.rational!));
    const signs=planes.map(plane=>classifyPointToSurface3(p,{kind:'plane',plane}));
    const rows=planes.flatMap((plane,i)=>signs[i]===0?[[plane.normal.x,plane.normal.y,plane.normal.z,plane.offset.neg()]]:[]),pivots:number[]=[];
    let rank=0;
    for(let col=0;col<3;col++){
      const id=rows.findIndex((row,i)=>i>=rank&&row[col]!.sign()!==0);if(id<0)continue;
      [rows[rank],rows[id]]=[rows[id]!,rows[rank]!];const divisor=rows[rank]![col]!;rows[rank]=rows[rank]!.map(v=>v.div(divisor));
      for(let j=0;j<rows.length;j++)if(j!==rank){const factor=rows[j]![col]!;rows[j]=rows[j]!.map((v,k)=>v.sub(rows[rank]![k]!.mul(factor)));}
      pivots.push(col);rank++;
    }
    if(rows.slice(rank).some(row=>row[3]!.sign()!==0))throw new Error('Algebraic point has inconsistent rational plane equalities');
    let coordinates=axes.map(k=>p[k]);
    while(true){
      const q=coordinates.map(v=>v.rational??v.lower.add(v.upper).div(two));
      pivots.forEach((col,i)=>{let v=rows[i]![3]!;for(let k=0;k<3;k++)if(!pivots.includes(k))v=v.sub(rows[i]![k]!.mul(q[k]!));q[col]=v;});
      const candidate=point3(q[0]!,q[1]!,q[2]!);
      if(planes.every((plane,i)=>evaluatePlane3(plane,candidate).sign()===signs[i]))return rationalLocate(candidate);
      coordinates=coordinates.map((v,k)=>pivots.includes(k)?v:v.refine());
    }
  };
}
