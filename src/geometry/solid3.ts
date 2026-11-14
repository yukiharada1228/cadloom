import { createSurfaceLocator3 } from './surface-location3.js';
import { Rational } from '../numeric/rational.js';
import type { Point3 } from './point3.js';
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
  const queries=components.map(createSurfaceLocator3);
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
  return Object.freeze({topology,shells,volume,locate:createSurfaceLocator3(triangles)});
}
