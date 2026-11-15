import {Rational} from '../numeric/rational.js';
import {point2,segment2} from './point2.js';
import type {Point2} from './point2.js';
import {point3,cross3,dot3,subtract3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {planeFrame3} from './curve3.js';
import {booleanPolygons} from './polygon-boolean.js';
import {preparePolygon} from './polygon-location.js';
import {preparePlanarFace3} from './planar-face3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';
import {sewBRepFaces3} from './sew-brep3.js';
import type {SewnBRep3} from './sew-brep3.js';
import {assertOwnedPlanarSolid3} from './planar-solid3.js';
import type {PreparedPlanarSolid3} from './planar-solid3.js';

export interface ConsolidatedPlanarSolid3 {
  readonly source:PreparedPlanarSolid3;
  readonly faces:readonly PreparedPlanarFace3[];
  readonly sewn:SewnBRep3;
  /** Output face → input polygonal face IDs, each assigned exactly once. */
  readonly sourceFaces:readonly (readonly number[])[];
  /** Input shell → output shell. */
  readonly shellMap:readonly number[];
  /** Source faces retained separately because their union has a pinched boundary. */
  readonly retainedFaces:readonly number[];
}
const owned=new WeakSet<ConsolidatedPlanarSolid3>();
export function assertOwnedConsolidatedPlanarSolid3(s:ConsolidatedPlanarSolid3):void {if(!owned.has(s))throw new RangeError('Expected factory-consolidated planar geometry');}
const key=(p:Point2)=>`${p.x},${p.y}`;
function canonical(p:Plane3){const n=p.normal,k=[n.x,n.y,n.z].find(v=>v.sign()!==0)!;return plane3(n.x.div(k),n.y.div(k),n.z.div(k),p.offset.div(k));}
function simplify(ring:readonly Point2[]):readonly Point2[]{
  return ring.filter((b,i)=>{const a=ring[(i+ring.length-1)%ring.length]!,c=ring[(i+1)%ring.length]!,ux=b.x.sub(a.x),uy=b.y.sub(a.y),vx=c.x.sub(b.x),vy=c.y.sub(b.y);return ux.mul(vy).sub(uy.mul(vx)).sign()!==0||ux.mul(vx).add(uy.mul(vy)).sign()<=0;});
}
/** Merge coplanar cooriented polygon patches into connected bounded faces,
 * retaining holes and disconnected regions and removing redundant collinear ports.
 * A pinched planar domain cannot be one manifold face; its source patches remain
 * separate and are reported, without changing the certified material boundary.
 */
export function consolidatePlanarSolid3(source:PreparedPlanarSolid3):ConsolidatedPlanarSolid3 {
  assertOwnedPlanarSolid3(source);
  const groups=new Map<string,{plane:Plane3;sense:1|-1;ids:number[]}>();
  source.topology.faces.forEach((f,id)=>{
    if(f.surface.kind!=='plane')throw new Error('Planar solid contains a curved face');
    const p=canonical(f.surface.plane),sense=(dot3(p.normal,f.surface.plane.normal).sign()*f.sense) as 1|-1,k=`${p.normal.x},${p.normal.y},${p.normal.z},${p.offset},${sense}`;
    let g=groups.get(k);if(!g){g={plane:p,sense,ids:[]};groups.set(k,g);}g.ids.push(id);
  });
  const faces:PreparedPlanarFace3[]=[],sourceFaces:(readonly number[])[]=[],retainedFaces:number[]=[];
  for(const g of groups.values()){
    const n=g.plane.normal,k=(['x','y','z'] as const).find(k=>n[k].sign()!==0)!,origin=point3(k==='x'?g.plane.offset.neg().div(n[k]):0n,k==='y'?g.plane.offset.neg().div(n[k]):0n,k==='z'?g.plane.offset.neg().div(n[k]):0n),seed=n.x.sign()===0?point3(1n,0n):n.y.sign()===0?point3(0n,1n):point3(0n,0n,1n),v=cross3(n,seed),u=cross3(v,n),U=dot3(u,u),V=dot3(v,v),frame=planeFrame3(origin,u,v);
    const project=(p:Point3)=>{const q=subtract3(p,origin);return point2(dot3(q,u).div(U),dot3(q,v).div(V));};
    const input=g.ids.map(id=>source.polygons[id]!.map(project)),union=booleanPolygons(input,[],'union','nonzero'),normalized=booleanPolygons(union.rings.map(simplify),[],'union','nonzero'),a=normalized.arrangement;
    const append=(rings:readonly (readonly Point2[])[],ids:readonly number[])=>{
      const oriented=g.sense===1?rings:rings.map(r=>[...r].reverse());
      faces.push(preparePlanarFace3(frame,oriented.map(r=>r.map((p,i)=>({kind:'segment' as const,segment:segment2(p,r[(i+1)%r.length]!)}))),g.sense));sourceFaces.push(Object.freeze([...ids]));
    };
    for(const id of normalized.selectedFaces){
      const rings=a.faces[id]!.boundaries.map(b=>simplify(a.boundaries[b]!.halfEdges.map(h=>a.vertices[a.halfEdges[h]!.origin]!.point))),region=preparePolygon(rings,'nonzero');
      const ids=g.ids.filter((_,i)=>{const p=input[i]!,sum=p.reduce((s,v)=>point2(s.x.add(v.x),s.y.add(v.y)),point2(0n,0n)),count=new Rational(BigInt(p.length));return region.locate(point2(sum.x.div(count),sum.y.div(count)))==='inside';});
      if(!ids.length)throw new Error('Consolidated face has no source coverage');
      const vertices=rings.flat().map(key);
      if(new Set(vertices).size!==vertices.length){
        for(const original of ids){const ring=input[g.ids.indexOf(original)]!;append([g.sense===1?ring:[...ring].reverse()],[original]);retainedFaces.push(original);}
      }else append(rings,ids);
    }
  }
  const uses=sourceFaces.flat();if(uses.length!==source.polygons.length||new Set(uses).size!==uses.length)throw new Error('Consolidation lost or duplicated an input face');
  const sewn=sewBRepFaces3(faces.map(f=>({surface:{kind:'plane',plane:f.surface},sense:f.sense,loops:f.boundary})),{requireClosed:true});
  const shellMap:number[]=source.topology.shells.map(()=>-1);
  sourceFaces.forEach((ids,face)=>{
    const old=source.topology.faces[ids[0]!]!.shell,next=sewn.topology.faces[face]!.shell;
    if(ids.some(id=>source.topology.faces[id]!.shell!==old)||shellMap[old]!==-1&&shellMap[old]!==next)throw new Error('Consolidation changed shell connectivity');shellMap[old]=next;
  });
  if(shellMap.some(id=>id<0)||new Set(shellMap).size!==shellMap.length||sewn.topology.shells.length!==shellMap.length)throw new Error('Consolidation merged or lost a shell');
  const result=Object.freeze({source,faces:Object.freeze(faces),sewn,sourceFaces:Object.freeze(sourceFaces),shellMap:Object.freeze(shellMap),retainedFaces:Object.freeze(retainedFaces)});owned.add(result);return result;
}
