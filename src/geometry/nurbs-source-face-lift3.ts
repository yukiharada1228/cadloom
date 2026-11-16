import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {nurbsSurfacePatches3} from './nurbs-surface3.js';
import type {NurbsSurfacePatch3} from './nurbs-surface3.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
import {sourceUvEdgeAtCoordinate3} from './nurbs-source-uv-edge3.js';
import {assertOwnedNurbsSourceFaces3} from './nurbs-source-faces3.js';
import type {NurbsSourceFaces3} from './nurbs-source-faces3.js';
type Classified=Extract<NurbsSourceFaces3,{kind:'classified'}>;
export interface NurbsSourceLiftEvent3 {readonly parameter:AlgebraicReal;readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly images:readonly Readonly<{patch:number;point:AlgebraicCoordinates3}>[];readonly continuous:boolean;}
export interface NurbsSourceLiftEdge3 {
 readonly axis:'u'|'v';readonly events:readonly NurbsSourceLiftEvent3[];
 readonly pieces:readonly Readonly<{lower:AlgebraicReal;upper:AlgebraicReal;patches:readonly number[];continuous:boolean}>[];
}
export type NurbsSourceFaceLift3=
 | Readonly<{kind:'unresolved';source:NurbsSourceFaces3;reason:'unresolved-faces'|'outside-active-domain'|'uv-fiber';edge?:number}>
 | Readonly<{kind:'lifted';source:Classified;patches:readonly NurbsSurfacePatch3[];edges:readonly NurbsSourceLiftEdge3[];vertices:readonly Readonly<{images:NurbsSourceLiftEvent3['images'];continuous:boolean}>[];cycles:readonly (readonly Readonly<{edge:number;piece:number;direction:1|-1}>[])[];continuous:boolean}>;
const owned=new WeakSet<NurbsSourceFaceLift3>(),real=(q:Rational)=>AlgebraicReal.fromRational(q);
const between=(a:AlgebraicReal,b:AlgebraicReal):Rational=>{while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));};
export function assertOwnedNurbsSourceFaceLift3(source:NurbsSourceFaceLift3):void {if(!owned.has(source))throw new RangeError('Expected factory-created source face boundary lift');}
function own<T extends NurbsSourceFaceLift3>(value:T):T {owned.add(value);return value;}
/** Lift every source-UV boundary atom through all incident one-sided patches.
 * Knot preimages split atoms; disagreement is retained, never averaged. */
export function liftNurbsSourceFaceBoundaries3(source:NurbsSourceFaces3):NurbsSourceFaceLift3 {
 assertOwnedNurbsSourceFaces3(source);if(source.kind==='unresolved')return own(Object.freeze({kind:'unresolved',source,reason:'unresolved-faces'}));
 const c=source.source.source,surface=c.source.source.source.source.equations.source,patches=nurbsSurfacePatches3(surface),edges:NurbsSourceLiftEdge3[]=[],vertexPatches=c.vertices.map(()=>new Set<number>());
 const inside=(p:NurbsSurfacePatch3,u:AlgebraicReal,v:AlgebraicReal)=>u.compare(real(p.startU))>=0&&u.compare(real(p.endU))<=0&&v.compare(real(p.startV))>=0&&v.compare(real(p.endV))<=0;
 const images=(ids:readonly number[],u:AlgebraicReal,v:AlgebraicReal)=>Object.freeze(ids.map(patch=>Object.freeze({patch,point:liftNurbsSectionPatch3(patches[patch]!,u,v)})));
 const equal=(xs:ReturnType<typeof images>)=>xs.every(x=>compareAlgebraicPoints3(x.point,xs[0]!.point)===0);
 for(const [edge,e] of c.edges.entries()){
  const a=c.vertices[e.from]!,b=c.vertices[e.to]!,axis=a.u.compare(b.u)!==0?'u':'v',lower=a[axis].compare(b[axis])<0?a[axis]:b[axis],upper=a[axis].compare(b[axis])<0?b[axis]:a[axis],cuts=[lower,upper];
  const uv=(t:AlgebraicReal)=>{const qs=sourceUvEdgeAtCoordinate3(c,edge,axis,t);return qs?.length===1?qs[0]!:null;};
  for(const [direction,knots] of [['u',surface.knotsU],['v',surface.knotsV]] as const)for(const knot of knots){const qs=sourceUvEdgeAtCoordinate3(c,edge,direction,real(knot));if(qs===null)continue;for(const q of qs){const t=q[axis];if(t.compare(lower)>0&&t.compare(upper)<0&&!cuts.some(x=>x.compare(t)===0))cuts.push(t);}}
  cuts.sort((x,y)=>x.compare(y));const pieces:NurbsSourceLiftEdge3['pieces'][number][]=[];
  for(let i=0;i+1<cuts.length;i++){
   const lo=cuts[i]!,hi=cuts[i+1]!,q=uv(real(between(lo,hi))),start=uv(lo),end=uv(hi);if(!q||!start||!end)return own(Object.freeze({kind:'unresolved',source,reason:'uv-fiber',edge}));
   const ids=patches.flatMap((p,id)=>inside(p,q.u,q.v)?[id]:[]);if(!ids.length||ids.some(id=>!inside(patches[id]!,start.u,start.v)||!inside(patches[id]!,end.u,end.v)))return own(Object.freeze({kind:'unresolved',source,reason:'outside-active-domain',edge}));
   const samePatchImage=(id:number)=>{const P=patches[ids[0]!]!,Q=patches[id]!;if(P===Q)return true;const constantU=start.u.compare(end.u)===0,constantV=start.v.compare(end.v)===0;if(!constantU&&!constantV)throw new Error('Multiple open incident patches without a knot-line atom');const fixed=(constantU?start.u:start.v).recognizeRational().rational;if(fixed===null)throw new Error('A NURBS knot line must be rational');return (['x','y','z'] as const).every(k=>{const f=P[k].mul(Q.weight).sub(Q[k].mul(P.weight));return (constantU?f.specializeU(fixed):f.specializeV(fixed)).degree<0;});};
   pieces.push(Object.freeze({lower:lo,upper:hi,patches:Object.freeze(ids),continuous:ids.every(samePatchImage)}));
  }
  const events=Object.freeze(cuts.map((parameter,i)=>{const q=uv(parameter)!;const ids=[...new Set([...(pieces[i-1]?.patches??[]),...(pieces[i]?.patches??[])])],xs=images(ids,q.u,q.v);return Object.freeze({parameter,u:q.u,v:q.v,images:xs,continuous:equal(xs)});}));
  for(const [vertex,t] of [[e.from,a[axis]],[e.to,b[axis]]] as const){const event=events.find(q=>q.parameter.compare(t)===0)!;event.images.forEach(q=>vertexPatches[vertex]!.add(q.patch));}
  edges.push(Object.freeze({axis,events,pieces:Object.freeze(pieces)}));
 }
 const vertices=c.vertices.map((v,id)=>{const ids=vertexPatches[id]!.size?[...vertexPatches[id]!]:patches.flatMap((p,k)=>inside(p,v.u,v.v)?[k]:[]);return {ids,images:images(ids,v.u,v.v)};});
 if(vertices.some(v=>!v.ids.length))return own(Object.freeze({kind:'unresolved',source,reason:'outside-active-domain'}));
 const cycles=Object.freeze(source.source.cycles.map(ids=>Object.freeze(ids.flatMap(h=>{const halfedge=source.source.halfedges[h]!,e=c.edges[halfedge.edge]!,lift=edges[halfedge.edge]!,direction=(c.vertices[e.to]![lift.axis].compare(c.vertices[e.from]![lift.axis])*halfedge.direction) as 1|-1,ps=lift.pieces.map((_,piece)=>Object.freeze({edge:halfedge.edge,piece,direction}));return direction===1?ps:ps.reverse();}))));
 const vs=Object.freeze(vertices.map(v=>Object.freeze({images:v.images,continuous:equal(v.images)})));
 return own(Object.freeze({kind:'lifted',source,patches,edges:Object.freeze(edges),vertices:vs,cycles,continuous:vs.every(v=>v.continuous)&&edges.every(e=>e.pieces.every(p=>p.continuous)&&e.events.every(q=>q.continuous))}));
}
export function evaluateNurbsSourceLiftPiece3(source:NurbsSourceFaceLift3,edge:number,piece:number,use:number,parameter:AlgebraicReal|ExactInput):Readonly<{u:AlgebraicReal;v:AlgebraicReal;patch:number;point:AlgebraicCoordinates3}> {
 assertOwnedNurbsSourceFaceLift3(source);if(source.kind!=='lifted')throw new RangeError('Source face boundary lift is unresolved');
 if(!Number.isSafeInteger(edge)||edge<0||edge>=source.edges.length)throw new RangeError('Invalid lifted edge');const e=source.edges[edge]!;
 if(!Number.isSafeInteger(piece)||piece<0||piece>=e.pieces.length)throw new RangeError('Invalid lifted piece');const p=e.pieces[piece]!;
 if(!Number.isSafeInteger(use)||use<0||use>=p.patches.length)throw new RangeError('Invalid lifted patch use');const t=parameter instanceof AlgebraicReal?parameter:AlgebraicReal.fromRational(parameter);
 if(t.compare(p.lower)<0||t.compare(p.upper)>0)throw new RangeError('Parameter is outside the lifted piece');const qs=sourceUvEdgeAtCoordinate3(source.source.source.source,edge,e.axis,t);if(qs?.length!==1)throw new Error('Lifted piece lost unique UV parameter');const q=qs[0]!,patch=p.patches[use]!;return Object.freeze({...q,patch,point:liftNurbsSectionPatch3(source.patches[patch]!,q.u,q.v)});
}
