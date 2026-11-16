import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {nurbsSurfaceSeams3} from './nurbs-surface-regularity3.js';
import {sourceUvEdgeAtCoordinate3} from './nurbs-source-uv-edge3.js';
import {locateNurbsSourceFace3} from './nurbs-source-face-location3.js';
import {assertOwnedNurbsSourceFaceLift3,evaluateNurbsSourceLiftPiece3} from './nurbs-source-face-lift3.js';
import type {NurbsSourceFaceLift3} from './nurbs-source-face-lift3.js';
type Lifted=Extract<NurbsSourceFaceLift3,{kind:'lifted'}>;
export interface NurbsSourceFacePatchUse3 {readonly edge:number;readonly piece:number;readonly direction:1|-1;readonly patch:number;}
export interface NurbsSourceFaceSeamInterval3 {
 readonly firstPatch:number;readonly secondPatch:number;readonly direction:'u'|'v';readonly parameter:Rational;
 readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;
 readonly faces:readonly number[];readonly interiorFaces:readonly number[];readonly continuous:boolean;
}
export interface NurbsSourceFacePatchSelection3 {
 readonly face:number;readonly cycles:readonly Readonly<{cycle:number;uses:readonly NurbsSourceFacePatchUse3[];closed:boolean}>[];
 readonly boundaryClosed:boolean;readonly interiorContinuous:boolean;readonly positionContinuous:boolean;
}
export type NurbsSourceFacePatches3=
 | Readonly<{kind:'unresolved';source:NurbsSourceFaceLift3;reason:'unresolved-lift'|'patch-side'|'uv-fiber'|'face-location'}>
 | Readonly<{kind:'selected';source:Lifted;faces:readonly NurbsSourceFacePatchSelection3[];seams:readonly NurbsSourceFaceSeamInterval3[]}>;
const owned=new WeakSet<NurbsSourceFacePatches3>();
function own<T extends NurbsSourceFacePatches3>(value:T):T {owned.add(value);return value;}
export function assertOwnedNurbsSourceFacePatches3(source:NurbsSourceFacePatches3):void {if(!owned.has(source))throw new RangeError('Expected factory-created source face patch selection');}
const real=(x:Rational)=>AlgebraicReal.fromRational(x);
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Select the UV-left patch for each inside-face boundary traversal and inspect
 * every source knot seam through its open interior. Position only, not rank or
 * embedding/material validity. Different faces may retain different seam sides. */
export function selectNurbsSourceFacePatches3(source:NurbsSourceFaceLift3):NurbsSourceFacePatches3 {
 assertOwnedNurbsSourceFaceLift3(source);if(source.kind==='unresolved')return own(Object.freeze({kind:'unresolved',source,reason:'unresolved-lift'}));
 const F=source.source,c=F.source.source,cycles:{cycle:number;uses:readonly NurbsSourceFacePatchUse3[];closed:boolean}[][]=[];
 for(const face of F.faces){if(face.location!=='inside'){cycles.push([]);continue;}const cs:{cycle:number;uses:readonly NurbsSourceFacePatchUse3[];closed:boolean}[]=[];
  for(const cycle of face.cycles){const uses:NurbsSourceFacePatchUse3[]=[];
   for(const u of source.cycles[cycle]!){const edge=source.edges[u.edge]!,piece=edge.pieces[u.piece]!,start=edge.events[u.piece]!,end=edge.events[u.piece+1]!,constantU=start.u.compare(end.u)===0,constantV=start.v.compare(end.v)===0;
    const ids=piece.patches.filter(id=>{const p=source.patches[id]!;if(constantU)return u.direction===1?real(p.startU).compare(start.u)<0:real(p.endU).compare(start.u)>0;if(constantV)return u.direction===1?real(p.endV).compare(start.v)>0:real(p.startV).compare(start.v)<0;return true;});
    if(ids.length!==1)return own(Object.freeze({kind:'unresolved',source,reason:'patch-side'}));uses.push(Object.freeze({...u,patch:ids[0]!}));
   }
   const endpoints=uses.map(u=>{const p=source.edges[u.edge]!.pieces[u.piece]!,use=p.patches.indexOf(u.patch),a=evaluateNurbsSourceLiftPiece3(source,u.edge,u.piece,use,u.direction===1?p.lower:p.upper).point,b=evaluateNurbsSourceLiftPiece3(source,u.edge,u.piece,use,u.direction===1?p.upper:p.lower).point;return {a,b};});
   const closed=endpoints.every((q,i)=>compareAlgebraicPoints3(q.b,endpoints[(i+1)%endpoints.length]!.a)===0);cs.push(Object.freeze({cycle,uses:Object.freeze(uses),closed}));
  }
  cycles.push(cs);
 }
 const seams:NurbsSourceFaceSeamInterval3[]=[];
 for(const seam of nurbsSurfaceSeams3(source.patches)){
  const p=source.patches[seam.firstPatch]!,axis=seam.direction==='u'?'v':'u',lower=real(axis==='v'?p.startV:p.startU),upper=real(axis==='v'?p.endV:p.endU),cuts=[lower,upper],fixed=real(seam.parameter),add=(t:AlgebraicReal)=>{if(t.compare(lower)>0&&t.compare(upper)<0&&!cuts.some(q=>q.compare(t)===0))cuts.push(t);};
  for(const v of c.vertices)if(v[seam.direction].compare(fixed)===0)add(v[axis]);
  for(let edge=0;edge<c.edges.length;edge++){const qs=sourceUvEdgeAtCoordinate3(c,edge,seam.direction,fixed);if(qs===null){const e=c.edges[edge]!,a=c.vertices[e.from]!,b=c.vertices[e.to]!;if(a[seam.direction].compare(fixed)!==0||b[seam.direction].compare(fixed)!==0)return own(Object.freeze({kind:'unresolved',source,reason:'uv-fiber'}));add(a[axis]);add(b[axis]);}else qs.forEach(q=>add(q[axis]));}
  cuts.sort((a,b)=>a.compare(b));for(let i=0;i+1<cuts.length;i++){
   const lo=cuts[i]!,hi=cuts[i+1]!,t=between(lo,hi),where=locateNurbsSourceFace3(F,seam.direction==='u'?seam.parameter:t,seam.direction==='v'?seam.parameter:t);if(where.kind==='unresolved')return own(Object.freeze({kind:'unresolved',source,reason:'face-location'}));
   const ids=where.kind==='face'?[where.face]:[...where.faces],faces=ids.filter(id=>F.faces[id]!.location==='inside');if(!faces.length)continue;
   const interiorFaces=where.kind==='face'?faces:faces.filter(id=>where.edges.length>0&&where.edges.every(edge=>F.halfedgeFaces[2*edge]===id&&F.halfedgeFaces[2*edge+1]===id));
   seams.push(Object.freeze({...seam,lower:lo,upper:hi,faces:Object.freeze(faces),interiorFaces:Object.freeze(interiorFaces)}));
  }
 }
 const faces=F.faces.flatMap((f,face)=>{if(f.location!=='inside')return [];const cs=Object.freeze(cycles[face]!),boundaryClosed=cs.every(c=>c.closed),interiorContinuous=seams.every(s=>!s.interiorFaces.includes(face)||s.continuous);return [Object.freeze({face,cycles:cs,boundaryClosed,interiorContinuous,positionContinuous:boundaryClosed&&interiorContinuous})];});
 return own(Object.freeze({kind:'selected',source,faces:Object.freeze(faces),seams:Object.freeze(seams)}));
}
