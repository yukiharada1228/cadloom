import { Rational } from '../numeric/rational.js';
import type { Sign } from '../numeric/rational.js';
import { point3 } from './point3.js';
import type { Point3 } from './point3.js';
import { evaluatePlane3, plane3 } from './plane3.js';
import type { Plane3 } from './plane3.js';
import {cross3,dot3,subtract3,pointsEqual3} from './point3.js';

export interface ConvexPolygonPlaneCell3 {
  /** Convex, positive-area polygon, preserving the source polygon's winding.
   * Collinear boundary vertices are allowed. No repeated closing vertex.
   */
  readonly polygon: readonly Point3[];
  /** Plane signs on the relative interior, in the input plane order. */
  readonly signs: readonly Sign[];
  /** Strict relative-interior witness, computed as the vertex average. */
  readonly witness: Point3;
}

/** Snapshots a simple, planar, positive-area convex boundary. Collinear forward
 * vertices are retained. Repeated vertices, backtracking and concavity are rejected.
 * Every vertex must lie in each directed edge's closed interior halfplane;
 * consecutive collinear edges must point in the same direction.
 */
function polygon3(input:readonly Point3[]):readonly Point3[] {
  const points=input.map(p=>point3(p.x,p.y,p.z));
  if(points.length<3)throw new RangeError('A convex polygon requires at least three vertices');
  for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)if(pointsEqual3(points[i]!,points[j]!))throw new RangeError('Polygon vertices must be distinct');
  const a=points[0]!;
  let normal:Point3|undefined;
  for(let i=1;i+1<points.length;i++){
    const n=cross3(subtract3(points[i]!,a),subtract3(points[i+1]!,a));
    if(dot3(n,n).sign()!==0){normal=n;break;}
  }
  if(!normal)throw new RangeError('Polygon must have positive area');
  if(points.some(p=>dot3(normal!,subtract3(p,a)).sign()!==0))throw new RangeError('Polygon must be planar');
  points.forEach((p,i)=>{
    const q=points[(i+1)%points.length]!,r=points[(i+2)%points.length]!,edge=subtract3(q,p),next=subtract3(r,q);
    const turn=dot3(cross3(edge,next),normal!).sign();
    if(turn<0||turn===0&&dot3(edge,next).sign()<=0)throw new RangeError('Polygon must be convex without backtracking');
    if(points.some(v=>dot3(cross3(edge,subtract3(v,p)),normal!).sign()<0))throw new RangeError('Polygon must be a simple convex boundary');
  });
  return Object.freeze(points);
}

/** Exact subdivision of a closed rational convex planar polygon by planes.
 * Cells cover the input, have disjoint relative interiors and retain its winding.
 * Cut boundaries belong to both adjacent cells; zero-area fragments are omitted.
 * No triangulation diagonals are introduced. Holes and nonconvex walks are rejected.
 * This is a face subdivision primitive, not a BRep or embedded-solid certificate.
 */
export function partitionConvexPolygonByPlanes3(input:readonly Point3[],inputPlanes:readonly Plane3[]):readonly ConvexPolygonPlaneCell3[] {
  const polygon=polygon3(input);
  const planes=inputPlanes.map(p=>plane3(p.normal.x,p.normal.y,p.normal.z,p.offset));
  let cells:{polygon:readonly Point3[];signs:Sign[]}[]=[{polygon,signs:[]}];
  for(const plane of planes){
    const next:typeof cells=[];
    for(const cell of cells){
      const values=cell.polygon.map(p=>evaluatePlane3(plane,p));
      const positive=values.some(v=>v.sign()>0),negative=values.some(v=>v.sign()<0);
      if(!positive||!negative){
        next.push({polygon:cell.polygon,signs:[...cell.signs,positive?1:negative?-1:0]});
        continue;
      }
      const sides:{positive:Point3[];negative:Point3[]}={positive:[],negative:[]};
      cell.polygon.forEach((a,i)=>{
        const b=cell.polygon[(i+1)%cell.polygon.length]!,u=values[i]!,v=values[(i+1)%values.length]!;
        if(u.sign()>=0)sides.positive.push(a);
        if(u.sign()<=0)sides.negative.push(a);
        if(u.sign()*v.sign()<0){
          const t=u.div(u.sub(v));
          const q=point3(a.x.add(b.x.sub(a.x).mul(t)),a.y.add(b.y.sub(a.y).mul(t)),a.z.add(b.z.sub(a.z).mul(t)));
          sides.positive.push(q);sides.negative.push(q);
        }
      });
      next.push({polygon:sides.positive,signs:[...cell.signs,1]}, {polygon:sides.negative,signs:[...cell.signs,-1]});
    }
    cells=next;
  }
  return Object.freeze(cells.map(cell=>{
    const sum=cell.polygon.reduce((s,p)=>point3(s.x.add(p.x),s.y.add(p.y),s.z.add(p.z)),point3(0n,0n,0n));
    const count=new Rational(BigInt(cell.polygon.length));
    return Object.freeze({polygon:Object.freeze(cell.polygon),signs:Object.freeze(cell.signs),witness:point3(sum.x.div(count),sum.y.div(count),sum.z.div(count))});
  }));
}
