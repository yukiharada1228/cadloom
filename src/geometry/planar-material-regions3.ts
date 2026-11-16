import {Rational} from '../numeric/rational.js';
import {point3,subtract3,cross3,dot3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3,evaluatePlane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {partitionConvexPolygonByPlanes3} from './convex-polygon-plane-arrangement3.js';
import {assertOwnedPlanarMaterialBoundary3} from './planar-solid-boolean3.js';
import type {PlanarSolidBooleanOperand3} from './planar-solid-boolean3.js';

export interface PlanarMaterialRegion3 {
 readonly material:boolean;
 readonly bounded:boolean;
 readonly sample:Point3;
 /** Exact bounded-region volume; null for the unbounded exterior. */
 readonly volume:Rational|null;
 readonly chambers:readonly number[];
 readonly boundaryUses:readonly number[];
}
export interface PlanarMaterialBoundaryUse3 {
 readonly face:number;
 readonly polygon:readonly Point3[];
 readonly materialRegion:number;
 readonly voidRegion:number;
}
export interface PlanarMaterialRegions3 {
 /** Region zero is the unbounded exterior. Other regions are open material/void components. */
 readonly regions:readonly PlanarMaterialRegion3[];
 readonly chambers:readonly Readonly<{sample:Point3;signs:readonly (-1|1)[];region:number}>[];
 readonly planes:readonly Plane3[];
 readonly boundaryUses:readonly PlanarMaterialBoundaryUse3[];
 readonly bounds:Readonly<{lower:Point3;upper:Point3}>;
}
const cache=new WeakMap<PlanarSolidBooleanOperand3,PlanarMaterialRegions3>();
const axes=['x','y','z'] as const,zero=new Rational(0n),one=new Rational(1n),two=new Rational(2n);
const key=(p:Point3)=>`${p.x},${p.y},${p.z}`;
/** Exact physical-plane chambers distinguish open material components from mere
 * edge/vertex contact. Facet adjacency connects equal-material chambers; all
 * bounded voids and the exterior are retained. No shell-manifold assumption.
 * Triple enumeration and the complete arrangement can be expensive; no fixed
 * plane-count cutoff or floating-point approximation changes the result. */
export function analyzePlanarMaterialRegions3(source:PlanarSolidBooleanOperand3):PlanarMaterialRegions3 {
 assertOwnedPlanarMaterialBoundary3(source);const prior=cache.get(source);if(prior)return prior;
 const points=source.polygons.flat(),lo=point3(...axes.map(k=>points.length?points.reduce((v,p)=>p[k].compare(v)<0?p[k]:v,points[0]![k]).sub(one):one.neg()) as [Rational,Rational,Rational]),hi=point3(...axes.map(k=>points.length?points.reduce((v,p)=>p[k].compare(v)>0?p[k]:v,points[0]![k]).add(one):one) as [Rational,Rational,Rational]);
 const planes:Plane3[]=[],planeIds=new Map<string,number>();
 const add=(p:Plane3)=>{
  const pivot=axes.map(k=>p.normal[k]).find(v=>v.sign()!==0)!,q=plane3(p.normal.x.div(pivot),p.normal.y.div(pivot),p.normal.z.div(pivot),p.offset.div(pivot)),id=`${key(q.normal)},${q.offset}`;
  if(!planeIds.has(id)){planeIds.set(id,planes.length);planes.push(q);}
 };
 for(const face of source.topology.faces){if(face.surface.kind!=='plane')throw new Error('Planar material has curved support');add(face.surface.plane);}
 for(const k of axes){const n=point3(k==='x'?1n:0n,k==='y'?1n:0n,k==='z'?1n:0n);add(plane3(n.x,n.y,n.z,lo[k].neg()));add(plane3(n.x,n.y,n.z,hi[k].neg()));}
 const verticesByKey=new Map<string,Point3>();
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
  const a=planes[i]!,b=planes[j]!,c=planes[k]!,bc=cross3(b.normal,c.normal),ca=cross3(c.normal,a.normal),ab=cross3(a.normal,b.normal),det=dot3(a.normal,bc);
  if(det.sign()===0)continue;
  const p=point3(...axes.map(v=>a.offset.mul(bc[v]).add(b.offset.mul(ca[v])).add(c.offset.mul(ab[v])).neg().div(det)) as [Rational,Rational,Rational]);
  if(axes.every(v=>p[v].compare(lo[v])>=0&&p[v].compare(hi[v])<=0))verticesByKey.set(key(p),p);
 }
 const vertices=[...verticesByKey.values()],signs=planes.map(p=>vertices.map(v=>evaluatePlane3(p,v).sign()));
 const full=(ids:readonly number[])=>{
  if(ids.length<4)return false;const origin=vertices[ids[0]!]!;let first:Point3|undefined,normal:Point3|undefined;
  for(const id of ids.slice(1)){const d=subtract3(vertices[id]!,origin);
   if(!first){if(dot3(d,d).sign()!==0)first=d;}
   else if(!normal){const c=cross3(first,d);if(dot3(c,c).sign()!==0)normal=c;}
   else if(dot3(normal,d).sign()!==0)return true;
  }return false;
 };
 type Cell={sample:Point3;signs:(-1|1)[];material:boolean;exterior:boolean};
 const cells:Cell[]=[],stack:{ids:number[];next:number;signs:(-1|1)[]}[]=[{ids:vertices.map((_,i)=>i),next:0,signs:[]}];
 while(stack.length){
  const current=stack.pop()!;if(!full(current.ids))continue;
  if(current.next===planes.length){
   const count=new Rational(BigInt(current.ids.length)),sample=point3(...axes.map(k=>current.ids.reduce((s,i)=>s.add(vertices[i]![k]),zero).div(count)) as [Rational,Rational,Rational]),location=source.locate(sample);
   if(location==='boundary'||planes.some((p,i)=>evaluatePlane3(p,sample).sign()!==current.signs[i]))throw new Error('Planar chamber lacks a strict material witness');
   const exterior=current.ids.some(i=>axes.some(k=>vertices[i]![k].equals(lo[k])||vertices[i]![k].equals(hi[k])));
   if(exterior&&location==='inside')throw new Error('Planar material reaches its exterior guard');
   cells.push({sample,signs:current.signs,material:location==='inside',exterior});continue;
  }
  for(const sign of [1,-1] as const){const ids=current.ids.filter(i=>signs[current.next]![i]!*sign>=0);if(ids.length)stack.push({ids,next:current.next+1,signs:[...current.signs,sign]});}
 }
 const cellKey=(s:readonly number[])=>s.map(v=>v===1?'+':'-').join(''),bySign=new Map(cells.map((c,i)=>[cellKey(c.signs),i])),parents=cells.map((_,i)=>i);
 if(!cells.length||bySign.size!==cells.length)throw new Error('Invalid planar chamber partition');
 const find=(i:number):number=>{while(parents[i]!==i){parents[i]=parents[parents[i]!]!;i=parents[i]!;}return i;};
 for(let i=0;i<cells.length;i++)for(let p=0;p<planes.length;p++){
  const s=[...cells[i]!.signs];s[p]=s[p]===1?-1:1;const j=bySign.get(cellKey(s));
  if(j!==undefined&&cells[i]!.material===cells[j]!.material){const a=find(i),b=find(j);parents[b]=a;}
 }
 const exteriorRoots=new Set(cells.flatMap((c,i)=>c.exterior?[find(i)]:[]));if(exteriorRoots.size!==1)throw new Error('Planar exterior guard is disconnected');
 const roots=[...exteriorRoots,...new Set(cells.map((_,i)=>find(i)).filter(i=>!exteriorRoots.has(i)))],regionByRoot=new Map(roots.map((r,i)=>[r,i])),cellRegions=cells.map((_,i)=>regionByRoot.get(find(i))!);
 const boundaryUses:PlanarMaterialBoundaryUse3[]=[];
 source.polygons.forEach((polygon,face)=>{
  const support=source.topology.faces[face]!.surface;if(support.kind!=='plane')throw new Error('Planar face has curved support');const n=support.plane.normal;
  for(const part of partitionConvexPolygonByPlanes3(polygon,planes)){
   const p=part.witness;let step=one;
   for(const plane of planes){const value=evaluatePlane3(plane,p),slope=dot3(plane.normal,n);if(value.sign()===0||slope.sign()===0)continue;const t=value.div(slope),bound=(t.sign()<0?t.neg():t).div(two);if(bound.compare(step)<0)step=bound;}
   const region=(sign:1|-1)=>{
    const t=sign===1?step:step.neg(),q=point3(p.x.add(n.x.mul(t)),p.y.add(n.y.mul(t)),p.z.add(n.z.mul(t))),s=planes.map(plane=>evaluatePlane3(plane,q).sign());
    if(s.some(v=>v===0))throw new Error('Planar face side lies on a chamber carrier');const id=bySign.get(cellKey(s));if(id===undefined)throw new Error('Planar face side is absent from chamber partition');return {id:cellRegions[id]!,material:cells[id]!.material};
   };
   const negative=region(-1),positive=region(1);
   if(!negative.material||positive.material)throw new Error('Planar face orientation disagrees with material regions');
   boundaryUses.push(Object.freeze({face,polygon:part.polygon,materialRegion:negative.id,voidRegion:positive.id}));
  }
 });
 const useVolumes=boundaryUses.map(b=>{const p=b.polygon;let sum=zero;for(let i=1;i+1<p.length;i++)sum=sum.add(dot3(p[0]!,cross3(p[i]!,p[i+1]!)));return sum.div(new Rational(6n));});
 const regions=roots.map((root,id)=>{
  const uses=boundaryUses.flatMap((b,i)=>b.materialRegion===id||b.voidRegion===id?[i]:[]),volume=id===0?null:uses.reduce((sum,i)=>sum.add(boundaryUses[i]!.materialRegion===id?useVolumes[i]!:useVolumes[i]!.neg()),zero);
  if(volume!==null&&volume.sign()<=0)throw new Error('Bounded planar region has nonpositive volume');
  return Object.freeze({material:cells[root]!.material,bounded:id!==0,sample:cells[root]!.sample,volume,chambers:Object.freeze(cellRegions.flatMap((r,i)=>r===id?[i]:[])),boundaryUses:Object.freeze(uses)});
 });
 if(!regions.filter(r=>r.material).reduce((sum,r)=>sum.add(r.volume!),zero).equals(source.volume))throw new Error('Planar region volumes disagree with source material');
 const result=Object.freeze({regions:Object.freeze(regions),chambers:Object.freeze(cells.map((c,i)=>Object.freeze({sample:c.sample,signs:Object.freeze(c.signs),region:cellRegions[i]!}))),planes:Object.freeze(planes),boundaryUses:Object.freeze(boundaryUses),bounds:Object.freeze({lower:lo,upper:hi})});
 cache.set(source,result);return result;
}
