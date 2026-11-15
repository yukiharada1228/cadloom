import {Rational} from '../numeric/rational.js';
import {point3} from './point3.js';
import type {Point3} from './point3.js';
import {triangle3} from './triangle3.js';
import type {Triangle3} from './triangle3.js';
import {prepareSolid3} from './solid3.js';
import {partitionPlanarBRepFaces3} from './planar-brep-partition3.js';
import type {PartitionedPlanarBRep3} from './planar-brep-partition3.js';
import type {BRepTopology3} from './brep-topology3.js';
import type {PointLocation} from './polygon-location.js';

export interface PlanarSolidShell3 {
  /** Polygonal BRep face indices, not the internal triangle indices. */
  readonly faces:readonly number[];
  readonly depth:number;
  readonly signedVolume:Rational;
}
export interface PreparedPlanarSolid3 {
  readonly boundary:PartitionedPlanarBRep3;
  readonly topology:BRepTopology3;
  /** Endpoint-conforming polygon boundaries in topology face order. */
  readonly polygons:readonly (readonly Point3[])[];
  /** Exact internal decomposition for embedding, shell nesting and point queries.
   * These triangles do not replace the polygonal BRep face/edge identities.
   */
  readonly triangles:readonly Triangle3[];
  readonly triangleFaces:readonly number[];
  readonly shells:readonly PlanarSolidShell3[];
  readonly volume:Rational;
  locate(point:Point3):PointLocation;
}
const owned=new WeakSet<PreparedPlanarSolid3>();
/** Internal ownership guard for subsequent material operations. */
export function assertOwnedPlanarSolid3(input:PreparedPlanarSolid3):void {
  if(!owned.has(input))throw new RangeError('Operation requires a factory-prepared planar solid');
}
/** Validate a bounded polygonal material solid, including cavities and islands.
 * Input faces must be convex rational polygons without holes; a nonconvex shell
 * and positive-genus shells can be assembled from multiple such faces.
 *
 * Sew exact endpoints before decomposition. Fan triangles from each strict face
 * interior preserve every sewn boundary port, including collinear subdivisions.
 * Existing exact triangle embedding and shell nesting checks then reject improper
 * intersections, touching shells and nonalternating material orientation.
 * No numerical tessellation or tolerance is used. Does not adopt general Body data
 * or certify curved/algebraic-coordinate faces. Validation is quadratic in triangles.
 */
export function preparePlanarSolid3(input:readonly (readonly Point3[])[]):PreparedPlanarSolid3 {
  const boundary=partitionPlanarBRepFaces3(input,[],{requireClosed:true}),topology=boundary.sewn.topology;
  const polygons=Object.freeze(topology.faces.map(face=>{
    if(face.loops.length!==1)throw new Error('Convex planar face must have exactly one boundary loop');
    return Object.freeze(topology.loops[face.loops[0]!]!.coedges.map(id=>{
      const v=topology.vertices[topology.coedges[id]!.origin]!;
      if(v.x.rational===null||v.y.rational===null||v.z.rational===null)throw new Error('Rational planar sewing produced a nonrational vertex');
      return point3(v.x.rational,v.y.rational,v.z.rational);
    }));
  }));
  const triangles:Triangle3[]=[],triangleFaces:number[]=[];
  polygons.forEach((polygon,face)=>{
    const sum=polygon.reduce((s,v)=>point3(s.x.add(v.x),s.y.add(v.y),s.z.add(v.z)),point3(0n,0n)),count=new Rational(BigInt(polygon.length));
    const center=point3(sum.x.div(count),sum.y.div(count),sum.z.div(count));
    polygon.forEach((a,i)=>{triangles.push(triangle3(center,a,polygon[(i+1)%polygon.length]!));triangleFaces.push(face);});
  });
  const solid=prepareSolid3(triangles),assigned=new Set<number>();
  const shells=Object.freeze(solid.shells.map(shell=>{
    const faces=Object.freeze([...new Set(shell.faces.map(id=>triangleFaces[id]!))].sort((a,b)=>a-b));
    const shellId=topology.faces[faces[0]!]!.shell,expected=topology.shells[shellId]!.faces;
    if(assigned.has(shellId)||faces.length!==expected.length||faces.some((id,i)=>id!==expected[i]))throw new Error('Polygon and triangle shell partitions disagree');
    assigned.add(shellId);return Object.freeze({faces,depth:shell.depth,signedVolume:shell.signedVolume});
  }));
  if(assigned.size!==topology.shells.length)throw new Error('A polygon shell was lost during exact decomposition');
  const result=Object.freeze({boundary,topology,polygons,triangles:Object.freeze(triangles),triangleFaces:Object.freeze(triangleFaces),shells,volume:solid.volume,locate:solid.locate});
  owned.add(result);return result;
}
