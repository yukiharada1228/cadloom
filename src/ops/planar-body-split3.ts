import {isOwnedCappedNurbsBody3} from '../model/capped-nurbs-body3.js';
import {Rational} from '../numeric/rational.js';
import {point3,subtract3,cross3,dot3} from '../geometry/point3.js';
import type {Point3} from '../geometry/point3.js';
import {plane3,evaluatePlane3} from '../geometry/plane3.js';
import type {Plane3} from '../geometry/plane3.js';
import {surfacesCoincide3} from '../geometry/surface3.js';
import {partitionConvexPolygonByPlanes3} from '../geometry/convex-polygon-plane-arrangement3.js';
import type {KernelBody3} from '../model/body3.js';
import {isOwnedNurbsBody3} from '../model/nurbs-body3.js';
import {isOwnedCellularBody3} from '../model/cellular-body3.js';
import type {CellularBody3} from '../model/cellular-body3.js';
import {cellularBodyFromPlanarMaterial3,planarMaterialOfCellularBody3} from './cellular-body3.js';
import {createPlanarMaterial3,planarMaterialFromBody3,booleanPlanarMaterials3,locatePlanarMaterial3} from './planar-material3.js';
import type {PlanarMaterial3} from './planar-material3.js';

export interface PlanarBodySplitInterface3 {
 readonly negativeFace:number;readonly positiveFace:number;
 /** Exact convex interface piece, oriented outward from the negative child. */
 readonly polygon:readonly Point3[];
}
export interface PlanarBodyPlaneSplit3 {
 /** Separated means no positive-area interface; closures may still touch. */
 readonly kind:'split'|'separated'|'one-sided'|'empty';
 readonly parent:KernelBody3;readonly plane:Plane3;
 readonly negative:CellularBody3;readonly positive:CellularBody3;
 /** All child faces on the cut plane, including pre-existing boundary faces. */
 readonly negativeCutFaces:readonly number[];readonly positiveCutFaces:readonly number[];
 /** Only new material-interior interfaces are paired. IDs belong to the children. */
 readonly shared:readonly PlanarBodySplitInterface3[];
}
const sources=new WeakMap<PlanarBodyPlaneSplit3,PlanarMaterial3>(),axes=['x','y','z'] as const,one=new Rational(1n);
/** Internal guard for geometry-derived split metadata. */
export function assertOwnedPlanarBodySplit3(split:PlanarBodyPlaneSplit3):void {if(!sources.has(split))throw new RangeError('Operation requires a factory-created planar Body split');}
const key=(p:Point3)=>`${p.x},${p.y},${p.z}`;
const average=(p:readonly Point3[])=>point3(...axes.map(k=>p.reduce((sum,v)=>sum.add(v[k]),new Rational(0n)).div(new Rational(BigInt(p.length)))) as [Rational,Rational,Rational]);
function boxFaces(lo:Point3,hi:Point3):readonly (readonly Point3[])[] {
 const p=(x:number,y:number,z:number)=>point3(x?hi.x:lo.x,y?hi.y:lo.y,z?hi.z:lo.z);
 return [[p(0,0,0),p(0,1,0),p(1,1,0),p(1,0,0)],[p(0,0,1),p(1,0,1),p(1,1,1),p(0,1,1)],[p(0,0,0),p(1,0,0),p(1,0,1),p(0,0,1)],[p(0,1,0),p(0,1,1),p(1,1,1),p(1,1,0)],[p(0,0,0),p(0,0,1),p(0,1,1),p(0,1,0)],[p(1,0,0),p(1,1,0),p(1,1,1),p(1,0,1)]];
}
/** Exact bounded halfspace mask. Its guard box strictly encloses all source material. */
function halfspaceMask(faces:readonly (readonly Point3[])[],plane:Plane3):PlanarMaterial3 {
 const values=faces.flat().map(p=>evaluatePlane3(plane,p).sign());
 if(!values.some(v=>v<0))return createPlanarMaterial3([]);
 if(!values.some(v=>v>0))return createPlanarMaterial3(faces);
 const selected=faces.flatMap(f=>partitionConvexPolygonByPlanes3(f,[plane]).filter(c=>c.signs[0]!<=0).map(c=>c.polygon));
 const points=[...new Map(selected.flat().filter(p=>evaluatePlane3(plane,p).sign()===0).map(p=>[key(p),p])).values()];
 if(points.length<3)throw new Error('Crossing guard plane has no area cap');
 const center=average(points),n=plane.normal,axis=n.x.sign()===0?point3(1n,0n,0n):point3(0n,1n,0n),u=cross3(n,axis),v=cross3(n,u);
 const local=points.map(p=>{const d=subtract3(p,center);return {p,x:dot3(d,u),y:dot3(d,v)};}),half=(p:typeof local[number])=>p.y.sign()>0||p.y.sign()===0&&p.x.sign()>=0?0:1;
 local.sort((a,b)=>half(a)-half(b)||-a.x.mul(b.y).sub(a.y.mul(b.x)).sign()||a.p.x.compare(b.p.x)||a.p.y.compare(b.p.y)||a.p.z.compare(b.p.z));
 return createPlanarMaterial3([...selected,local.map(p=>p.p)]);
}
function polygon(body:CellularBody3,face:number):readonly Point3[] {
 const f=body.topology.faces[face]!;if(f.loops.length!==1)throw new Error('Convex cellular face has multiple loops');
 return Object.freeze(body.topology.loops[f.loops[0]!]!.coedges.map(id=>{const p=body.topology.vertices[body.topology.coedges[id]!.origin]!;if(p.x.rational===null||p.y.rational===null||p.z.rational===null)throw new Error('Planar split has a nonrational vertex');return point3(p.x.rational,p.y.rational,p.z.rational);}));
}
function polygonKey(points:readonly Point3[]):string {
 return points.filter((p,i)=>{const c=cross3(subtract3(p,points[(i+points.length-1)%points.length]!),subtract3(points[(i+1)%points.length]!,p));return dot3(c,c).sign()!==0;}).map(key).sort().join(';');
}
/** Closed regularized halfspace split of owned rational planar material.
 * Exact Boolean selection retains cavities, holes, disconnected components and contacts.
 * Curved/nonrational boundaries require other backends and fail explicitly. */
export function splitPlanarBodyByPlane3(body:KernelBody3,inputPlane:Plane3):PlanarBodyPlaneSplit3 {
 if(isOwnedNurbsBody3(body)||isOwnedCappedNurbsBody3(body))throw new RangeError('Planar splitting does not support a NURBS Body');
 const material=isOwnedCellularBody3(body)?planarMaterialOfCellularBody3(body):planarMaterialFromBody3(body),plane=plane3(inputPlane.normal.x,inputPlane.normal.y,inputPlane.normal.z,inputPlane.offset),points=material.polygons.flat();
 let negativeMaterial:PlanarMaterial3,positiveMaterial:PlanarMaterial3;
 if(!points.length){negativeMaterial=material;positiveMaterial=material;}
 else {
  const lower=point3(...axes.map(k=>points.reduce((s,p)=>p[k].compare(s)<0?p[k]:s,points[0]![k]).sub(one)) as [Rational,Rational,Rational]),upper=point3(...axes.map(k=>points.reduce((s,p)=>p[k].compare(s)>0?p[k]:s,points[0]![k]).add(one)) as [Rational,Rational,Rational]),faces=boxFaces(lower,upper),n=plane.normal;
  negativeMaterial=booleanPlanarMaterials3(material,halfspaceMask(faces,plane),'intersection');
  positiveMaterial=booleanPlanarMaterials3(material,halfspaceMask(faces,plane3(n.x.neg(),n.y.neg(),n.z.neg(),plane.offset.neg())),'intersection');
 }
 if(!negativeMaterial.volume.add(positiveMaterial.volume).equals(material.volume))throw new Error('Planar split volumes do not partition the source material');
 if(negativeMaterial.polygons.some(p=>p.some(v=>evaluatePlane3(plane,v).sign()>0))||positiveMaterial.polygons.some(p=>p.some(v=>evaluatePlane3(plane,v).sign()<0)))throw new Error('Planar split boundary escaped its closed halfspace');
 const negative=cellularBodyFromPlanarMaterial3(negativeMaterial),positive=cellularBodyFromPlanarMaterial3(positiveMaterial);
 const cuts=(child:CellularBody3)=>child.topology.faces.flatMap((face,id)=>surfacesCoincide3(face.surface,{kind:'plane',plane})?[id]:[]),negativeCutFaces=Object.freeze(cuts(negative)),positiveCutFaces=Object.freeze(cuts(positive));
 const interiors=(child:CellularBody3,ids:readonly number[],side:1|-1)=>{
  const result=new Map<string,{face:number;polygon:readonly Point3[]}>();
  for(const face of ids){const p=polygon(child,face),location=locatePlanarMaterial3(material,average(p)),f=child.topology.faces[face]!;if(f.surface.kind!=='plane'||dot3(f.surface.plane.normal,plane.normal).sign()*f.sense!==side)throw new Error('Planar cut face has inconsistent physical orientation');
   if(location==='outside')throw new Error('Cut boundary is outside source material');if(location==='boundary')continue;
   const id=polygonKey(p);if(result.has(id))throw new Error('Duplicate planar split interface');result.set(id,{face,polygon:p});
  }return result;
 };
 const a=interiors(negative,negativeCutFaces,1),b=interiors(positive,positiveCutFaces,-1),shared:PlanarBodySplitInterface3[]=[];
 for(const [id,p] of a){const q=b.get(id);if(!q)throw new Error('Negative cut interface has no equal positive face');shared.push(Object.freeze({negativeFace:p.face,positiveFace:q.face,polygon:p.polygon}));b.delete(id);}
 if(b.size)throw new Error('Positive cut interface has no equal negative face');
 const kind=!material.polygons.length?'empty':shared.length?'split':negativeMaterial.volume.sign()>0&&positiveMaterial.volume.sign()>0?'separated':'one-sided';
 const result=Object.freeze({kind,parent:body,plane,negative,positive,negativeCutFaces,positiveCutFaces,shared:Object.freeze(shared)});sources.set(result,material);return result;
}
/** Recompute the union and check exact regularized equality to the owned source. */
export function rejoinPlanarBodySplit3(split:PlanarBodyPlaneSplit3):CellularBody3 {
 const source=sources.get(split);if(!source)throw new RangeError('Rejoining requires a factory-created planar Body split');
 const joined=booleanPlanarMaterials3(planarMaterialOfCellularBody3(split.negative),planarMaterialOfCellularBody3(split.positive),'union');
 if(booleanPlanarMaterials3(joined,source,'xor').polygons.length)throw new Error('Rejoined split does not equal its source material');
 return cellularBodyFromPlanarMaterial3(joined);
}
