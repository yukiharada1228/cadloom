import { Rational } from '../numeric/rational.js';
import type { Sign } from '../numeric/rational.js';
import { point3 } from './point3.js';
import type { Point3 } from './point3.js';
import { evaluatePlane3, plane3 } from './plane3.js';
import type { Plane3 } from './plane3.js';
import { triangle3 } from './triangle3.js';
import type { Triangle3 } from './triangle3.js';

export interface TrianglePlaneCell3 {
  /** Convex, positive-area polygon, preserving the source triangle's winding.
   * Collinear boundary vertices are allowed. No repeated closing vertex.
   */
  readonly polygon: readonly Point3[];
  /** Plane signs on the relative interior, in the input plane order. */
  readonly signs: readonly Sign[];
  /** Strict relative-interior witness, computed as the vertex average. */
  readonly witness: Point3;
}

/** Partitions a closed triangle by supporting planes without introducing fan diagonals.
 * Cells cover the triangle, have disjoint relative interiors, and retain source winding.
 * Shared cut boundaries belong to both adjacent cells; zero-area cells are omitted.
 * This is a surface subdivision primitive, not a solid Boolean or topology builder.
 */
export function partitionTriangleByPlanes3(input:Triangle3, inputPlanes:readonly Plane3[]):readonly TrianglePlaneCell3[] {
  const triangle=triangle3(...input);
  const planes=inputPlanes.map(p=>plane3(p.normal.x,p.normal.y,p.normal.z,p.offset));
  let cells:{polygon:readonly Point3[];signs:Sign[]}[]=[{polygon:triangle,signs:[]}];
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
