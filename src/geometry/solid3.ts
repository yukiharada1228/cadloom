import { Rational } from '../numeric/rational.js';
import { cross3, dot3, point3, subtract3, vector3 } from './point3.js';
import type { Point3 } from './point3.js';
import { evaluatePlane3, planeFromPoints } from './plane3.js';
import { triangle3 } from './triangle3.js';
import type { Triangle3 } from './triangle3.js';
import { buildTriangleTopology } from './triangle-topology.js';
import type { TriangleTopology } from './triangle-topology.js';
import { inspectTriangleEmbedding } from './triangle-intersection3.js';
import type { PointLocation } from './polygon-location.js';

export interface SolidShell3 {
  readonly faces: readonly number[];
  readonly depth: number;
  readonly signedVolume: Rational;
}
export interface PreparedSolid3 {
  readonly topology: TriangleTopology;
  readonly shells: readonly SolidShell3[];
  readonly volume: Rational;
  locate(point: Point3): PointLocation;
}

/** Private query against already certified disjoint closed surfaces. */
function locator(triangles: readonly Triangle3[]) {
  const faces=triangles.map(triangle=>({triangle,plane:planeFromPoints(...triangle)}));
  function edgeSigns(p:Point3,face:typeof faces[number]) {
    return face.triangle.map((a,i)=>dot3(cross3(subtract3(face.triangle[(i+1)%3]!,a),subtract3(p,a)),face.plane.normal).sign());
  }
  return (input:Point3):PointLocation=>{
    const p=point3(input.x,input.y,input.z);
    const values=faces.map(f=>evaluatePlane3(f.plane,p));
    if(faces.some((f,i)=>values[i]!.sign()===0&&edgeSigns(p,f).every(s=>s>=0)))return 'boundary';
    // At most 2 bad directions per plane and 2 per edge: 8 per face.
    for(let n=0n;n<=8n*BigInt(faces.length);n++){
      const direction=vector3(1n,n,n*n);
      let crossings=0,bad=false;
      for(let i=0;i<faces.length;i++){
        const f=faces[i]!,denominator=dot3(f.plane.normal,direction);
        if(denominator.sign()===0){bad=true;break;}
        const t=values[i]!.neg().div(denominator);
        if(t.sign()<=0)continue;
        const q=point3(p.x.add(direction.x.mul(t)),p.y.add(direction.y.mul(t)),p.z.add(direction.z.mul(t)));
        const signs=edgeSigns(q,f);
        if(signs.some(s=>s<0))continue;
        if(signs.some(s=>s===0)){bad=true;break;}
        crossings++;
      }
      if(!bad)return crossings%2===1?'inside':'outside';
    }
    throw new Error('Generic rational ray bound violated');
  };
}

/** Certifies a finite triangular material solid, including cavities and nested islands.
 * Rejects open, nonmanifold, self-intersecting, touching or incorrectly oriented shells.
 * Validation is quadratic in the number of faces; queries use exact rational arithmetic.
 */
export function prepareSolid3(input:readonly Triangle3[]):PreparedSolid3 {
  const triangles=Object.freeze(input.map(t=>triangle3(...t)));
  const topology=buildTriangleTopology(triangles);
  if(!topology.closedManifold)throw new RangeError('Solid requires closed consistently oriented manifold topology');
  if(!inspectTriangleEmbedding(triangles).embedded)throw new RangeError('Solid surfaces must be embedded without improper intersections');
  const components=topology.shells.map(s=>s.faces.map(i=>triangles[i]!));
  const queries=components.map(locator);
  const shells=Object.freeze(topology.shells.map((s,i)=>{
    const witness=components[i]![0]![0];
    let depth=0;
    queries.forEach((query,j)=>{
      if(i===j)return;
      const location=query(witness);
      if(location==='boundary')throw new RangeError('Distinct solid shells must not touch');
      if(location==='inside')depth++;
    });
    const signedVolume=s.signedVolume!;
    if(signedVolume.sign()!==(depth%2===0?1:-1))throw new RangeError('Shell orientation must alternate with nesting depth');
    return Object.freeze({faces:s.faces,depth,signedVolume});
  }));
  const volume=shells.reduce((sum,s)=>sum.add(s.signedVolume),new Rational(0n));
  return Object.freeze({topology,shells,volume,locate:locator(triangles)});
}
