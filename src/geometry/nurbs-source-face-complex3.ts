import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {certifyNurbsSourceFaceEmbedding3} from './nurbs-source-face-embedding3.js';
import type {NurbsSourceFaceEmbedding3} from './nurbs-source-face-embedding3.js';
import type {NurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
import {evaluateNurbsSourceLiftPiece3} from './nurbs-source-face-lift3.js';
export interface NurbsSourceComplexVertex3 {readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly point:AlgebraicCoordinates3;}
export interface NurbsSourceComplexEdge3 {
 readonly sourceEdge:number;readonly sourcePiece:number;readonly from:number;readonly to:number;
 readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;
 readonly uses:readonly Readonly<{face:number;cycle:number;offset:number;direction:1|-1;patch:number}>[];
}
export type NurbsSourceFaceComplex3=
 | Readonly<{kind:'not-prepared';embedding:NurbsSourceFaceEmbedding3;reason:'unresolved-patches'|'uncertified-face'}>
 | Readonly<{kind:'prepared';source:Extract<NurbsSourceFacePatches3,{kind:'selected'}>;embedding:Extract<NurbsSourceFaceEmbedding3,{kind:'analyzed'}>;
   vertices:readonly NurbsSourceComplexVertex3[];edges:readonly NurbsSourceComplexEdge3[];
   faces:readonly Readonly<{face:number;cycles:readonly Readonly<{cycle:number;role:'outer'|'hole'|'wire';uses:readonly Readonly<{edge:number;direction:1|-1}>[]}>[]}>[];
   boundaryEdges:readonly number[];pairedEdges:readonly number[];nonmanifoldEdges:readonly number[]}>;
const owned=new WeakSet<NurbsSourceFaceComplex3>();
function own<T extends NurbsSourceFaceComplex3>(x:T):T {owned.add(x);return x;}
/** Sew certified source faces only along identical finite UV atoms and whole
 * spatial images. This is a face complex, not a solid or global embedding. */
export function prepareNurbsSourceFaceComplex3(source:NurbsSourceFacePatches3):NurbsSourceFaceComplex3 {
 const embedding=certifyNurbsSourceFaceEmbedding3(source);
 if(embedding.kind==='unresolved'||source.kind!=='selected')return own(Object.freeze({kind:'not-prepared',embedding,reason:'unresolved-patches'}));
 if(embedding.faces.some(f=>f.kind!=='certified'))return own(Object.freeze({kind:'not-prepared',embedding,reason:'uncertified-face'}));
 const L=source.source,F=L.source,vertices:NurbsSourceComplexVertex3[]=[],edges:{sourceEdge:number;sourcePiece:number;from:number;to:number;lower:AlgebraicReal;upper:AlgebraicReal;uses:{face:number;cycle:number;offset:number;direction:1|-1;patch:number}[]}[]=[],groups=new Map<string,number[]>();
 const vertex=(q:NurbsSourceComplexVertex3)=>{const id=vertices.findIndex(v=>v.u.compare(q.u)===0&&v.v.compare(q.v)===0&&compareAlgebraicPoints3(v.point,q.point)===0);if(id>=0)return id;vertices.push(Object.freeze({u:q.u,v:q.v,point:q.point}));return vertices.length-1;};
 const sameImage=(edge:number,piece:number,a:number,b:number)=>{
  if(a===b)return true;const e=L.edges[edge]!,p=e.pieces[piece]!;if(p.continuous)return true;
  const P=L.patches[a]!,Q=L.patches[b]!,start=e.events[piece]!,end=e.events[piece+1]!,constantU=start.u.compare(end.u)===0,constantV=start.v.compare(end.v)===0;
  if(!constantU&&!constantV)throw new Error('Distinct patch uses without a knot-line source atom');
  const fixed=(constantU?start.u:start.v).recognizeRational().rational;if(fixed===null)throw new Error('Source knot-line parameter must be rational');
  return (['x','y','z'] as const).every(k=>{const f=P[k].mul(Q.weight).sub(Q[k].mul(P.weight));return (constantU?f.specializeU(fixed):f.specializeV(fixed)).degree<0;});
 };
 const faces=source.faces.map(f=>Object.freeze({face:f.face,cycles:Object.freeze(f.cycles.map(c=>{
  const uses=c.uses.map((u,offset)=>{const p=L.edges[u.edge]!.pieces[u.piece]!,key=`${u.edge}:${u.piece}`,ids=groups.get(key)??[];let id=ids.find(id=>sameImage(u.edge,u.piece,edges[id]!.uses[0]!.patch,u.patch));
   if(id===undefined){const use=p.patches.indexOf(u.patch);if(use<0)throw new Error('Selected patch lost lifted provenance');const a=evaluateNurbsSourceLiftPiece3(L,u.edge,u.piece,use,p.lower),b=evaluateNurbsSourceLiftPiece3(L,u.edge,u.piece,use,p.upper);id=edges.length;edges.push({sourceEdge:u.edge,sourcePiece:u.piece,from:vertex(a),to:vertex(b),lower:p.lower,upper:p.upper,uses:[]});ids.push(id);groups.set(key,ids);}
   edges[id]!.uses.push(Object.freeze({face:f.face,cycle:c.cycle,offset,direction:u.direction,patch:u.patch}));return Object.freeze({edge:id,direction:u.direction});
  });
  for(let i=0;i<uses.length;i++){const a=uses[i]!,b=uses[(i+1)%uses.length]!,A=edges[a.edge]!,B=edges[b.edge]!;if((a.direction===1?A.to:A.from)!==(b.direction===1?B.from:B.to))throw new Error('Certified face boundary lost UV/spatial closure');}
  const definition=F.faces[f.face]!,role=definition.outerCycles.includes(c.cycle)?'outer':definition.holeCycles.includes(c.cycle)?'hole':'wire';return Object.freeze({cycle:c.cycle,role,uses:Object.freeze(uses)});
 }))}));
 const boundaryEdges:number[]=[],pairedEdges:number[]=[],nonmanifoldEdges:number[]=[];
 edges.forEach((e,id)=>{if(e.uses.length===1)boundaryEdges.push(id);else if(e.uses.length===2&&e.uses[0]!.direction!==e.uses[1]!.direction)pairedEdges.push(id);else nonmanifoldEdges.push(id);});
 return own(Object.freeze({kind:'prepared',source,embedding,vertices:Object.freeze(vertices),edges:Object.freeze(edges.map(e=>Object.freeze({...e,uses:Object.freeze(e.uses)}))),faces:Object.freeze(faces),boundaryEdges:Object.freeze(boundaryEdges),pairedEdges:Object.freeze(pairedEdges),nonmanifoldEdges:Object.freeze(nonmanifoldEdges)}));
}
/** Explicit incidence selects the patch side; no spatial or UV branch guess. */
export function evaluateNurbsSourceComplexEdge3(complex:NurbsSourceFaceComplex3,edge:number,use:number,parameter:AlgebraicReal|ExactInput):Readonly<{u:AlgebraicReal;v:AlgebraicReal;patch:number;point:AlgebraicCoordinates3}> {
 if(!owned.has(complex))throw new RangeError('Expected factory-created NURBS source face complex');if(complex.kind!=='prepared')throw new RangeError('Source face complex is not prepared');
 if(!Number.isSafeInteger(edge)||edge<0||edge>=complex.edges.length)throw new RangeError('Invalid source complex edge');const e=complex.edges[edge]!;
 if(!Number.isSafeInteger(use)||use<0||use>=e.uses.length)throw new RangeError('Invalid source complex use');const L=complex.source.source,p=L.edges[e.sourceEdge]!.pieces[e.sourcePiece]!,patch=e.uses[use]!.patch;
 return evaluateNurbsSourceLiftPiece3(L,e.sourceEdge,e.sourcePiece,p.patches.indexOf(patch),parameter);
}
/** Internal ownership guard shared by exact face queries. */
export function assertOwnedNurbsSourceFaceComplex3(complex:NurbsSourceFaceComplex3):void {if(!owned.has(complex))throw new RangeError('Expected factory-created NURBS source face complex');}
