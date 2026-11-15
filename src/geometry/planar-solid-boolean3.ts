import {Rational} from '../numeric/rational.js';
import {point3,cross3,dot3,subtract3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3,evaluatePlane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {partitionConvexPolygonByPlanes3} from './convex-polygon-plane-arrangement3.js';
import {partitionPlanarBRepFaces3} from './planar-brep-partition3.js';
import type {PartitionedPlanarBRep3} from './planar-brep-partition3.js';
import {assertOwnedPlanarSolid3,decomposePlanarBoundary3} from './planar-solid3.js';
import type {PreparedPlanarSolid3} from './planar-solid3.js';
import type {BRepTopology3} from './brep-topology3.js';
import type {Triangle3} from './triangle3.js';
import {inspectTriangleEmbedding} from './triangle-intersection3.js';
import {createSurfaceLocator3} from './surface-location3.js';
import type {BooleanOperation} from './polygon-boolean.js';
import type {PointLocation} from './polygon-location.js';

export interface PlanarBooleanFaceSource3 {readonly operand:0|1;readonly face:number;}
export interface PlanarSolidBooleanResult3 {
  readonly boundary:PartitionedPlanarBRep3;
  readonly topology:BRepTopology3;
  readonly polygons:readonly (readonly Point3[])[];
  /** Output polygon → input operand face IDs whose domains cover its interior.
   * Coplanar coincident sources are retained together. IDs refer to this operation.
   */
  readonly faceSources:readonly (readonly PlanarBooleanFaceSource3[])[];
  readonly triangles:readonly Triangle3[];
  readonly triangleFaces:readonly number[];
  readonly volume:Rational;
  /** Regularized material membership; edge/vertex contacts remain boundary. */
  locate(point:Point3):PointLocation;
}
export type PlanarSolidBooleanOperand3=PreparedPlanarSolid3|PlanarSolidBooleanResult3;
const ownedResults=new WeakSet<PlanarSolidBooleanResult3>();
function operand(s:PlanarSolidBooleanOperand3){
  if(!ownedResults.has(s as PlanarSolidBooleanResult3))assertOwnedPlanarSolid3(s as PreparedPlanarSolid3);
  return s;
}
const key=(p:Point3)=>`${p.x},${p.y},${p.z}`;
function canonical(p:Plane3):Plane3 {
  const n=p.normal,k=[n.x,n.y,n.z].find(v=>v.sign()!==0)!;
  return plane3(n.x.div(k),n.y.div(k),n.z.div(k),p.offset.div(k));
}
const planeKey=(p:Plane3)=>`${key(p.normal)},${p.offset}`;
function polygonKey(p:readonly Point3[]):string {
  // A convex region is determined by its extreme vertices, independent of
  // traversal, cyclic seam and any extra collinear boundary ports.
  return p.filter((v,i)=>{
    const c=cross3(subtract3(v,p[(i+p.length-1)%p.length]!),subtract3(p[(i+1)%p.length]!,v));
    return dot3(c,c).sign()!==0;
  }).map(key).sort().join(';');
}
function truth(a:boolean,b:boolean,op:BooleanOperation):boolean {
  switch(op){case 'union':return a||b;case 'intersection':return a&&b;case 'difference':return a&&!b;case 'xor':return a!==b;}
}
/** Regularized Boolean on factory-validated rational planar material boundaries.
 * Split original polygon faces directly; retain convex polygon cells and source
 * face IDs. Coplanar coverage is arranged by all boundary lines in that support.
 * No input/output approximate mesh conversion or triangle Boolean is used.
 *
 * Output can contain balanced nonmanifold edge/vertex contacts; incidence reports
 * them. Such results remain owned material operands for further Booleans. Improper
 * face intersections and unbalanced boundary uses are rejected as internal errors.
 * Curved/algebraic faces and common Body adoption remain outside this API.
 */
export function booleanPlanarSolids3(inputA:PlanarSolidBooleanOperand3,inputB:PlanarSolidBooleanOperand3,operation:BooleanOperation):PlanarSolidBooleanResult3 {
  if(!['union','intersection','difference','xor'].includes(operation))throw new RangeError('Unknown Boolean operation');
  const a=operand(inputA),b=operand(inputB);
  type Source={polygon:readonly Point3[];operand:0|1;face:number};
  const groups=new Map<string,{plane:Plane3;sources:Source[]}>();
  [a,b].forEach((s,owner)=>s.polygons.forEach((polygon,face)=>{
    const support=s.topology.faces[face]!.surface;if(support.kind!=='plane')throw new Error('Planar operand has a curved face');
    const plane=canonical(support.plane),id=planeKey(plane);let group=groups.get(id);
    if(!group){group={plane,sources:[]};groups.set(id,group);}
    group.sources.push({polygon,operand:owner as 0|1,face});
  }));
  const allPlanes=[...groups.values()].map(g=>g.plane),polygons:Point3[][]=[],faceSources:(readonly PlanarBooleanFaceSource3[])[]=[];
  for(const group of groups.values()){
    const cuts=new Map(allPlanes.map(p=>[planeKey(p),p]));
    // Coplanar overlays need boundary lines, not merely their common support.
    for(const source of group.sources)source.polygon.forEach((p,i)=>{
      const n=cross3(subtract3(source.polygon[(i+1)%source.polygon.length]!,p),group.plane.normal);
      const plane=canonical(plane3(n.x,n.y,n.z,dot3(n,p).neg()));cuts.set(planeKey(plane),plane);
    });
    const cells=new Map<string,{polygon:readonly Point3[];witness:Point3;sources:PlanarBooleanFaceSource3[]}>();
    for(const source of group.sources)for(const cell of partitionConvexPolygonByPlanes3(source.polygon,[...cuts.values()])){
      const id=polygonKey(cell.polygon),found=cells.get(id),origin=Object.freeze({operand:source.operand,face:source.face});
      if(found)found.sources.push(origin);else cells.set(id,{polygon:cell.polygon,witness:cell.witness,sources:[origin]});
    }
    for(const cell of cells.values()){
      const p=cell.witness,n=group.plane.normal;let step=new Rational(1n);
      for(const plane of allPlanes){
        const value=evaluatePlane3(plane,p),slope=dot3(plane.normal,n);
        if(value.sign()===0){if(planeKey(plane)!==planeKey(group.plane))throw new Error('Face cell interior meets a distinct support plane');continue;}
        if(slope.sign()===0)continue;
        const ratio=value.div(slope),distance=(ratio.sign()<0?ratio.neg():ratio).div(new Rational(2n));
        if(distance.compare(step)<0)step=distance;
      }
      const side=(sign:1|-1)=>{
        const t=sign===1?step:step.neg(),q=point3(p.x.add(n.x.mul(t)),p.y.add(n.y.mul(t)),p.z.add(n.z.mul(t))),x=a.locate(q),y=b.locate(q);
        if(x==='boundary'||y==='boundary')throw new Error('Boolean side witness reached material boundary');
        return truth(x==='inside',y==='inside',operation);
      };
      const positive=side(1),negative=side(-1);if(positive===negative)continue;
      const polygon=[...cell.polygon],normal=polygon.reduce((sum,v,i)=>{const c=cross3(subtract3(v,polygon[0]!),subtract3(polygon[(i+1)%polygon.length]!,polygon[0]!));return point3(sum.x.add(c.x),sum.y.add(c.y),sum.z.add(c.z));},point3(0n,0n));
      if(dot3(normal,n).sign()!==(negative?1:-1))polygon.reverse();
      polygons.push(polygon);faceSources.push(Object.freeze(cell.sources));
    }
  }
  const boundary=partitionPlanarBRepFaces3(polygons,[]),topology=boundary.sewn.topology,decomposition=decomposePlanarBoundary3(boundary);
  if(topology.edges.some(e=>e.coedges.length<2||e.coedges.reduce((sum,id)=>sum+topology.coedges[id]!.direction,0)!==0))throw new Error('Planar Boolean has an unbalanced boundary edge');
  if(!inspectTriangleEmbedding(decomposition.triangles).embedded)throw new Error('Planar Boolean has an improper face intersection');
  const volume=decomposition.triangles.reduce((s,t)=>s.add(dot3(t[0],cross3(t[1],t[2]))),new Rational(0n)).div(new Rational(6n));
  if(volume.sign()<0)throw new Error('Planar Boolean has negative material volume');
  const result=Object.freeze({boundary,topology,...decomposition,faceSources:Object.freeze(faceSources),volume,locate:createSurfaceLocator3(decomposition.triangles)});
  ownedResults.add(result);return result;
}
