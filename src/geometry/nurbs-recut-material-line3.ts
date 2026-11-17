import {assertOwnedNurbsRecutMaterial3} from './nurbs-recut-material3.js';
import type {NurbsRecutMaterialCertificate3} from './nurbs-recut-material3.js';
import {intersectSewnNurbsSourceLine3} from './sewn-nurbs-source-ray3.js';
import type {SewnNurbsSourceRay3} from './sewn-nurbs-source-ray3.js';
import type {SewnNurbsMaterialLineHit3} from './sewn-nurbs-source-material-line3.js';
import {locateNurbsRecutMaterial3} from './nurbs-recut-material-query3.js';
import type {NurbsRecutMaterialLocation3} from './nurbs-recut-material-query3.js';
import type {NurbsRecutParitySearchOptions3} from './nurbs-recut-ray3.js';
import {line3} from './surface3.js';
import type {Line3} from './surface3.js';
import {point3,dot3} from './point3.js';
import type {Point3} from './point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {algebraicPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {Rational} from '../numeric/rational.js';
export interface NurbsRecutMaterialLineHit3 {
 readonly parameter:AlgebraicReal;readonly point:AlgebraicCoordinates3;readonly sourceHit:SewnNurbsMaterialLineHit3|null;
 /** Nonparallel plane roots contributing this event, not plane membership. */
 readonly cutPlanes:readonly (0|1)[];readonly refinement:boolean;
}
export interface NurbsRecutMaterialLineSpan3 {readonly start:NurbsRecutMaterialLineHit3;readonly end:NurbsRecutMaterialLineHit3;readonly sample:Point3;readonly sampleParameter:Rational;readonly location:'inside'|'boundary';}
export type NurbsRecutMaterialLine3=
 | Readonly<{kind:'resolved';material:NurbsRecutMaterialCertificate3;line:Line3;parent:Exclude<SewnNurbsSourceRay3,{kind:'unresolved'}>|null;intervals:readonly Readonly<{start:NurbsRecutMaterialLineHit3;end:NurbsRecutMaterialLineHit3;spans:readonly NurbsRecutMaterialLineSpan3[]}>[];isolated:readonly NurbsRecutMaterialLineHit3[]}>
 | Readonly<{kind:'unresolved';material:NurbsRecutMaterialCertificate3;reason:'parent-section'|'material-query'|'inconsistent-closure';parent?:SewnNurbsSourceRay3;query?:NurbsRecutMaterialLocation3}>;
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Complete closed line/material intersection, including tangent points and
 * contained boundary spans. Raw source events, both isolated cut-plane roots
 * and on-line refinement vertices form the finite event partition. The latter
 * are essential when an entire line lies in a cut plane and only an interior
 * subinterval of a raw boundary overlap survives regularization. */
export function intersectNurbsRecutMaterialLine3(material:NurbsRecutMaterialCertificate3,input:Line3,options:NurbsRecutParitySearchOptions3={}):NurbsRecutMaterialLine3 {
 assertOwnedNurbsRecutMaterial3(material);
 for(const n of [options.maxDirections??128,options.maxFaceDirections??16])if(!Number.isSafeInteger(n)||n<1)throw new RangeError('Line query budgets must be positive safe integers');
 const E=material.containment.embedding,source=E.source,line=line3(input.origin,input.direction),K=E.inherited.previous.source.source,H=source.source.boundary.source;
 if(!source.topology.faces.length)return Object.freeze({kind:'resolved',material,line,parent:null,intervals:Object.freeze([]),isolated:Object.freeze([])});
 const parent=intersectSewnNurbsSourceLine3(K.material.containment.embedding.source,line);
 if(parent.kind==='unresolved')return Object.freeze({kind:'unresolved',material,reason:'parent-section',parent});
 const events:{parameter:AlgebraicReal;point:AlgebraicCoordinates3;sourceHit:SewnNurbsMaterialLineHit3|null;cutPlanes:(0|1)[];refinement:boolean}[]=parent.hits.map(sourceHit=>({parameter:sourceHit.parameter,point:sourceHit.point,sourceHit,cutPlanes:[],refinement:false}));
 const add=(parameter:AlgebraicReal,point:AlgebraicCoordinates3,cut:0|1|null,refinement:boolean)=>{let old=events.find(e=>e.parameter.compare(parameter)===0);if(!old){old={parameter,point,sourceHit:null,cutPlanes:[],refinement:false};events.push(old);}else if(compareAlgebraicPoints3(old.point,point)!==0)throw new Error('Equal material line parameters lost XYZ equality');if(cut!==null&&!old.cutPlanes.includes(cut))old.cutPlanes.push(cut);old.refinement ||= refinement;};
 for(const [cut,P] of [K.boundary.source.source.plane,H.plane].entries()){const d=dot3(P.normal,line.direction);if(d.sign()!==0){const t=AlgebraicReal.fromRational(dot3(P.normal,line.origin).add(P.offset).neg().div(d));add(t,algebraicPoint3(line.origin,line.direction,t),cut as 0|1,false);}}
 const axis=(['x','y','z'] as const).find(k=>line.direction[k].sign()!==0)!,scale=new Rational(1n).div(line.direction[axis]),refine=(point:AlgebraicCoordinates3)=>{const t=point[axis].affine(scale,line.origin[axis].neg().mul(scale));if(compareAlgebraicPoints3(point,algebraicPoint3(line.origin,line.direction,t))===0)add(t,point,null,true);};
 for(const b of E.inherited.source.source.inputs)for(const v of b.source.vertices)refine(v.point);
 for(const b of E.inherited.source.caps)for(const p of b.source.vertices)refine(p);
 for(const p of source.topology.vertices)refine(p);
 for(const p of E.sourceCaps.audit.points)refine(p.point);
 for(const p of E.oldCaps.points)refine(p.point);
 events.sort((a,b)=>a.parameter.compare(b.parameter));const records=events.map(e=>Object.freeze({...e,cutPlanes:Object.freeze(e.cutPlanes)})),kept:boolean[]=[];
 for(const e of records){const q=locateNurbsRecutMaterial3(E,e.point,options);if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',material,reason:'material-query',parent,query:q});kept.push(q.kind!=='outside');}
 const pieces:{first:number;last:number;spans:NurbsRecutMaterialLineSpan3[]}[]=[],covered=new Set<number>();
 for(let i=0;i+1<records.length;i++){const start=records[i]!,end=records[i+1]!,sampleParameter=between(start.parameter,end.parameter),sample=point3(line.origin.x.add(line.direction.x.mul(sampleParameter)),line.origin.y.add(line.direction.y.mul(sampleParameter)),line.origin.z.add(line.direction.z.mul(sampleParameter))),q=locateNurbsRecutMaterial3(E,sample,options);if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',material,reason:'material-query',parent,query:q});if(q.kind==='outside')continue;
  if(!kept[i]||!kept[i+1])return Object.freeze({kind:'unresolved',material,reason:'inconsistent-closure',parent});covered.add(i);covered.add(i+1);const span=Object.freeze({start,end,sample,sampleParameter,location:q.kind}),previous=pieces.at(-1);if(previous&&previous.last===i){previous.last=i+1;previous.spans.push(span);}else pieces.push({first:i,last:i+1,spans:[span]});
 }
 return Object.freeze({kind:'resolved',material,line,parent,intervals:Object.freeze(pieces.map(p=>Object.freeze({start:records[p.first]!,end:records[p.last]!,spans:Object.freeze(p.spans)}))),isolated:Object.freeze(records.filter((_,i)=>kept[i]&&!covered.has(i)))});
}
