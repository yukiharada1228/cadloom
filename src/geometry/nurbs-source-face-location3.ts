import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {assertOwnedNurbsSourceFaces3} from './nurbs-source-faces3.js';
import type {NurbsSourceFaces3} from './nurbs-source-faces3.js';
import {sourceUvEdgeAtCoordinate3} from './nurbs-source-uv-edge3.js';
export type NurbsSourceFaceLocation3=
 | Readonly<{kind:'face';face:number;location:'inside'|'outside'}>
 | Readonly<{kind:'edge';edges:readonly number[];faces:readonly number[]}>
 | Readonly<{kind:'vertex';vertex:number;edges:readonly number[];faces:readonly number[]}>
 | Readonly<{kind:'unresolved';reason:'unresolved-faces'|'fiber-collision'|'unclassified-signature'}>;
/** Exact source-UV stratum lookup, including algebraic points and ray/vertex
 * coincidences. Edge/vertex incidence is not spatial material membership. */
export function locateNurbsSourceFace3(source:NurbsSourceFaces3,uInput:AlgebraicReal|ExactInput,vInput:AlgebraicReal|ExactInput):NurbsSourceFaceLocation3 {
 assertOwnedNurbsSourceFaces3(source);if(source.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'unresolved-faces'});
 const u=uInput instanceof AlgebraicReal?uInput:AlgebraicReal.fromRational(uInput),v=vInput instanceof AlgebraicReal?vInput:AlgebraicReal.fromRational(vInput),c=source.source.source,vertex=c.vertices.findIndex(q=>q.u.compare(u)===0&&q.v.compare(v)===0),edges:number[]=[],crossing=new Map<number,number>();
 for(const [edge,e] of c.edges.entries()){
  const a=c.vertices[e.from]!,b=c.vertices[e.to]!,axis=a.u.compare(b.u)!==0?'u':'v',points=sourceUvEdgeAtCoordinate3(c,edge,axis,axis==='u'?u:v);
  if(points===null)return Object.freeze({kind:'unresolved',reason:'fiber-collision'});
  if(points.some(q=>q.u.compare(u)===0&&q.v.compare(v)===0))edges.push(edge);
  // Standard half-open horizontal ray; constant-v atoms do not cross it.
  const av=a.v.compare(v),bv=b.v.compare(v),sign=av<=0&&bv>0?1:bv<=0&&av>0?-1:0;
  if(sign){const hits=sourceUvEdgeAtCoordinate3(c,edge,'v',v);if(hits===null||hits.length!==1)return Object.freeze({kind:'unresolved',reason:'fiber-collision'});if(hits[0]!.u.compare(u)>0)crossing.set(edge,sign);}
 }
 const incident=Object.freeze([...new Set(edges.flatMap(e=>[source.halfedgeFaces[2*e]!,source.halfedgeFaces[2*e+1]!]))].sort((a,b)=>a-b));
 if(edges.length)return vertex>=0?Object.freeze({kind:'vertex',vertex,edges:Object.freeze(edges),faces:incident}):Object.freeze({kind:'edge',edges:Object.freeze(edges),faces:incident});
 const winding=source.source.cycles.map(ids=>ids.reduce((sum,id)=>{const h=source.source.halfedges[id]!;return sum+(crossing.get(h.edge)??0)*h.direction;},0)),cycle=source.windings.findIndex(w=>w.every((n,i)=>n===winding[i]));
 if(cycle<0)return Object.freeze({kind:'unresolved',reason:'unclassified-signature'});const face=source.cycleFaces[cycle]!;
 return vertex>=0?Object.freeze({kind:'vertex',vertex,edges:Object.freeze([]),faces:Object.freeze([face])}):Object.freeze({kind:'face',face,location:source.faces[face]!.location});
}
