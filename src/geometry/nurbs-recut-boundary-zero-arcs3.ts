import {assertOwnedCappedNurbsRecutHalf3,locateNurbsRecutClosedSurface3} from './cap-nurbs-recut-half3.js';
import type {CappedNurbsRecutHalf3} from './cap-nurbs-recut-half3.js';
import {analyzeNurbsRecutInteriorZeroArcs3} from './nurbs-recut-interior-zero-arcs3.js';
import type {NurbsRecutInteriorZeroArcs3} from './nurbs-recut-interior-zero-arcs3.js';
import {nurbsRecutJoinedCurvePoint3} from './nurbs-recut-face-join3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';
import type {ExactInput} from './point2.js';

type Closed=Extract<CappedNurbsRecutHalf3,{kind:'closed'}>;
type Interior=Extract<NurbsRecutInteriorZeroArcs3,{kind:'analyzed'}>;
type Location='inside'|'outside'|'boundary';
export interface NurbsRecutBoundaryZeroArcCertificate3 {
 readonly source:Closed;
 readonly input:number;
 readonly cellEdge:number;
 readonly nodedEdge:number;
 readonly localEdge:number;
 readonly sewnEdge:number;
 readonly joinedEdge:number;
 readonly edge:number;
 readonly direction:1|-1;
 readonly sourceFace:number;
 /** These are the final curve's native parameters, which need not be the
  * original source-cell parameters after nonlinear shared-edge sewing. */
 readonly lower:AlgebraicReal;
 readonly upper:AlgebraicReal;
 readonly method:'owned-boundary-interval-lineage';
 readonly caps:readonly Readonly<{capFace:number;declaredBoundary:boolean;openLocation:Location;lowerLocation:Location;upperLocation:Location}>[];
}
export type NurbsRecutBoundaryZeroArcs3=
 | Readonly<{kind:'unresolved';source:CappedNurbsRecutHalf3;reason:'interior-analysis'|'interval-coverage'|'face-incidence'|'cap-query'|'undeclared-boundary'|'inconsistent-locations'}>
 | Readonly<{kind:'analyzed';source:Closed;interior:Interior;certifiesAbsence:false;
  arcs:readonly NurbsRecutBoundaryZeroArcCertificate3[];
  coverage:readonly Readonly<{input:number;cellEdge:number;kind:'interior'|'boundary'|'discarded';arcs:readonly number[]}>[]}>;
const owned=new WeakSet<NurbsRecutBoundaryZeroArcCertificate3>();

/** Follow complete owned interval maps, not point coincidence, from each
 * source zero edge through noding, adoption, sewing, joining and half selection.
 * Each final open boundary edge is either the very same declared cap edge, or
 * disjoint from all cap-boundary interiors under inherited old-boundary
 * embedding and canonical noding. Its remaining cap membership is constant.
 * All endpoints are queried separately. Old planar cap/source contacts and a
 * full embedding/material certificate remain outside this result's scope. */
export function analyzeNurbsRecutBoundaryZeroArcs3(source:CappedNurbsRecutHalf3,options:Readonly<{maxDirections?:number}>={}):NurbsRecutBoundaryZeroArcs3 {
 assertOwnedCappedNurbsRecutHalf3(source);
 const fail=(reason:Extract<NurbsRecutBoundaryZeroArcs3,{kind:'unresolved'}>['reason']):NurbsRecutBoundaryZeroArcs3=>Object.freeze({kind:'unresolved',source,reason});
 const interior=analyzeNurbsRecutInteriorZeroArcs3(source,options);
 if(interior.kind!=='analyzed')return fail('interior-analysis');
 const closed=interior.source,T=closed.topology,H=closed.source.boundary.source,G=H.source,R=G.source;
 const arcs:NurbsRecutBoundaryZeroArcCertificate3[]=[],coverage:Extract<NurbsRecutBoundaryZeroArcs3,{kind:'analyzed'}>['coverage'][number][]=[];
 for(const {input,zeroSet} of interior.inspection.audits){
  const C=zeroSet.source,built=R.inputs[input]!;
  if(built.source.source.vertices.cells!==C)throw new Error('Zero audit lost input identity');
  const N=built.source;
  for(const z of zeroSet.edges){
   if(interior.arcs.some(a=>a.input===input&&a.edge===z.edge)){coverage.push(Object.freeze({input,cellEdge:z.edge,kind:'interior',arcs:Object.freeze([])}));continue;}
   const e=C.edges[z.edge]!,faces=T.faces.flatMap((f,face)=>{
    const s=f.surface;if(s.kind!=='retained'||s.source.kind!=='source'||s.source.source.source!==N)return [];
    const region=N.regions[s.source.source.region]!;
    return e.uses.some(u=>region.cells.includes(u.cell))?[{face,region}]:[];
   });
   if(!faces.length){coverage.push(Object.freeze({input,cellEdge:z.edge,kind:'discarded',arcs:Object.freeze([])}));continue;}
   const ids:number[]=[];
   for(const {face,region} of faces){
    let cursor=e.lower;
    const pieces=N.sourceUses[z.edge]!;
    for(const piece of pieces){
     const n=N.edges[piece.edge]!;
     if(piece.direction!==1||n.parent!==z.edge||n.lower.compare(cursor)!==0||n.upper.compare(n.lower)<=0||!region.boundary.some(u=>u.edge===piece.edge))return fail('interval-coverage');
     const localEdge=built.sourceEdges[piece.edge];
     if(localEdge===null||localEdge===undefined)return fail('interval-coverage');
     const sewnUses=R.sourceEdges[input]![localEdge];
     if(!sewnUses?.length)return fail('interval-coverage');
     let previous:AlgebraicCoordinates3=N.vertices[n.from]!.point;
     for(const sewnUse of sewnUses){
      const joinedUses=G.sourceEdges[sewnUse.edge];
      if(!joinedUses?.length)return fail('interval-coverage');
      // Expansion maps use their parent's positive direction. Reverse order
      // as well as orientation when the sewn parameterization runs backward.
      const ordered=sewnUse.direction===1?joinedUses:[...joinedUses].reverse();
      for(const joinedUse of ordered){
       const halfEdge=H.sourceEdges[joinedUse.edge];
       if(halfEdge===null||halfEdge===undefined)return fail('interval-coverage');
       const edge=closed.sourceEdges[halfEdge];
       if(edge===undefined)return fail('interval-coverage');
       const final=T.edges[edge]!,curve=final.curve,direction=(sewnUse.direction*joinedUse.direction) as 1|-1;
       if(!final.coedges.some(h=>T.coedges[h]!.face===face))return fail('face-incidence');
       const start=T.vertices[direction===1?final.start:final.end]!,end=T.vertices[direction===1?final.end:final.start]!;
       if(compareAlgebraicPoints3(previous,start)!==0)return fail('interval-coverage');
       previous=end;
       let a=curve.lower,b=curve.upper;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}
       const sample=nurbsRecutJoinedCurvePoint3(curve,a.upper.add(b.lower).div(new Rational(2n))),lower=T.vertices[final.start]!,upper=T.vertices[final.end]!,caps:NurbsRecutBoundaryZeroArcCertificate3['caps'][number][]=[];
       for(const capFace of closed.capFaces){
        const cap=T.faces[capFace]!.surface;
        if(cap.kind!=='cap')throw new Error('New cap map lost its surface family');
        const declaredBoundary=final.coedges.some(h=>T.coedges[h]!.face===capFace);
        const queries=[sample,lower,upper].map(p=>locateNurbsRecutClosedSurface3(cap,p,options)),[middle,x,y]=queries;
        if(!middle||!x||!y)throw new Error('Missing closed boundary arc query');
        if(middle.kind==='unresolved'||x.kind==='unresolved'||y.kind==='unresolved')return fail('cap-query');
        if(declaredBoundary){if([middle.location,x.location,y.location].some(l=>l!=='boundary'))return fail('inconsistent-locations');}
        else {if(middle.location==='boundary')return fail('undeclared-boundary');if([x.location,y.location].some(l=>l!=='boundary'&&l!==middle.location))return fail('inconsistent-locations');}
        caps.push(Object.freeze({capFace,declaredBoundary,openLocation:middle.location,lowerLocation:x.location,upperLocation:y.location}));
       }
       const certificate:NurbsRecutBoundaryZeroArcCertificate3=Object.freeze({source:closed,input,cellEdge:z.edge,nodedEdge:piece.edge,localEdge,sewnEdge:sewnUse.edge,joinedEdge:joinedUse.edge,edge,direction,sourceFace:face,lower:curve.lower,upper:curve.upper,method:'owned-boundary-interval-lineage',caps:Object.freeze(caps)});
       owned.add(certificate);ids.push(arcs.length);arcs.push(certificate);
      }
     }
     if(compareAlgebraicPoints3(previous,N.vertices[n.to]!.point)!==0)return fail('interval-coverage');
     cursor=n.upper;
    }
    if(cursor.compare(e.upper)!==0)return fail('interval-coverage');
   }
   coverage.push(Object.freeze({input,cellEdge:z.edge,kind:'boundary',arcs:Object.freeze(ids)}));
  }
 }
 return Object.freeze({kind:'analyzed',source:closed,interior,certifiesAbsence:false,arcs:Object.freeze(arcs),coverage:Object.freeze(coverage)});
}

export function nurbsRecutBoundaryZeroArcPoint3(source:NurbsRecutBoundaryZeroArcCertificate3,input:AlgebraicReal|ExactInput):Readonly<{point:AlgebraicCoordinates3;caps:readonly Readonly<{capFace:number;location:Location}>[]}> {
 if(!owned.has(source))throw new RangeError('Expected factory-created boundary zero arc certificate');
 const parameter=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);
 if(parameter.compare(source.lower)<0||parameter.compare(source.upper)>0)throw new RangeError('Parameter outside certified boundary zero arc');
 const point=nurbsRecutJoinedCurvePoint3(source.source.topology.edges[source.edge]!.curve,parameter),caps=source.caps.map(c=>Object.freeze({capFace:c.capFace,location:parameter.compare(source.lower)===0?c.lowerLocation:parameter.compare(source.upper)===0?c.upperLocation:c.openLocation}));
 return Object.freeze({point,caps:Object.freeze(caps)});
}
