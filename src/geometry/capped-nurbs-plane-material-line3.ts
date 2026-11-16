import {assertOwnedCappedNurbsPlaneMaterial3} from './capped-nurbs-plane-material3.js';
import type {CappedNurbsPlaneMaterialCertificate3} from './capped-nurbs-plane-material3.js';
import {intersectSewnNurbsSourceMaterialLine3} from './sewn-nurbs-source-material-line3.js';
import type {SewnNurbsMaterialLine3,SewnNurbsMaterialLineHit3} from './sewn-nurbs-source-material-line3.js';
import {locateCappedNurbsPlaneMaterial3} from './capped-nurbs-plane-query3.js';
import type {CappedNurbsPlaneMaterialLocation3} from './capped-nurbs-plane-query3.js';
import {line3} from './surface3.js';
import type {Line3} from './surface3.js';
import {point3,dot3} from './point3.js';
import type {Point3} from './point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {algebraicCoordinates3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {Rational} from '../numeric/rational.js';
import type {SewnNurbsParitySearchOptions3} from './sewn-nurbs-source-parity-search3.js';
export interface CappedNurbsMaterialLineHit3 {readonly parameter:AlgebraicReal;readonly point:AlgebraicCoordinates3;readonly sourceHit:SewnNurbsMaterialLineHit3|null;readonly cut:boolean;}
export interface CappedNurbsMaterialLineSpan3 {readonly start:CappedNurbsMaterialLineHit3;readonly end:CappedNurbsMaterialLineHit3;readonly sample:Point3;readonly sampleParameter:Rational;readonly location:'inside'|'boundary';}
export type CappedNurbsMaterialLine3=
 | Readonly<{kind:'resolved';material:CappedNurbsPlaneMaterialCertificate3;line:Line3;parent:Extract<SewnNurbsMaterialLine3,{kind:'resolved'}>|null;intervals:readonly Readonly<{start:CappedNurbsMaterialLineHit3;end:CappedNurbsMaterialLineHit3;spans:readonly CappedNurbsMaterialLineSpan3[]}>[];isolated:readonly CappedNurbsMaterialLineHit3[]}>
 | Readonly<{kind:'unresolved';material:CappedNurbsPlaneMaterialCertificate3;reason:'parent-section'|'material-query'|'inconsistent-closure';parent?:SewnNurbsMaterialLine3;query?:CappedNurbsPlaneMaterialLocation3}>;
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Complete closed line-material intersection under the owned transverse (or
 * empty) embedding gate. Add the cut-plane event to every parent boundary
 * event; plane-contained lines retain exact closed boundary spans. */
export function intersectCappedNurbsPlaneMaterialLine3(material:CappedNurbsPlaneMaterialCertificate3,input:Line3,options:SewnNurbsParitySearchOptions3={}):CappedNurbsMaterialLine3 {
 assertOwnedCappedNurbsPlaneMaterial3(material);const source=material.containment.embedding.source,line=line3(input.origin,input.direction),B=source.source.boundary,P=B.source.source.plane,n=P.normal;
 if(!source.topology.faces.length)return Object.freeze({kind:'resolved',material,line,parent:null,intervals:Object.freeze([]),isolated:Object.freeze([])});
 if(material.containment.embedding.method!=='transverse-halfspace')throw new RangeError('Nonempty capped material line scan requires a complete transverse section');
 const parent=intersectSewnNurbsSourceMaterialLine3(source.source.material,line,options);if(parent.kind==='unresolved')return Object.freeze({kind:'unresolved',material,reason:'parent-section',parent});
 const events:CappedNurbsMaterialLineHit3[]=parent.boundary.hits.map(sourceHit=>Object.freeze({parameter:sourceHit.parameter,point:sourceHit.point,sourceHit,cut:false})),denominator=dot3(n,line.direction),value=dot3(n,line.origin).add(P.offset),at=(t:Rational)=>point3(line.origin.x.add(line.direction.x.mul(t)),line.origin.y.add(line.direction.y.mul(t)),line.origin.z.add(line.direction.z.mul(t)));
 if(denominator.sign()!==0){const t=value.neg().div(denominator),parameter=AlgebraicReal.fromRational(t),old=events.findIndex(e=>e.parameter.compare(parameter)===0);if(old>=0)events[old]=Object.freeze({...events[old]!,cut:true});else {const p=at(t);events.push(Object.freeze({parameter,point:algebraicCoordinates3(p.x,p.y,p.z),sourceHit:null,cut:true}));}}
 events.sort((a,b)=>a.parameter.compare(b.parameter));const kept:boolean[]=[];
 for(const e of events){if(e.sourceHit){const sign=AlgebraicReal.linearCombination([{value:e.point.x,coefficient:n.x},{value:e.point.y,coefficient:n.y},{value:e.point.z,coefficient:n.z}],P.offset).sign();
   // Strict selected-side source boundary persists. At zero, the owned whole
   // transverse section proves both children retain the source boundary point.
   kept.push(sign===0||sign===B.source.side);
  }else {const p=at(e.parameter.rational!),q=locateCappedNurbsPlaneMaterial3(source,p,options);if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',material,reason:'material-query',parent,query:q});kept.push(q.kind!=='outside');}}
 const pieces:{first:number;last:number;spans:CappedNurbsMaterialLineSpan3[]}[]=[],covered=new Set<number>();
 for(let i=0;i+1<events.length;i++){
  const start=events[i]!,end=events[i+1]!,sampleParameter=between(start.parameter,end.parameter),sample=at(sampleParameter),q=locateCappedNurbsPlaneMaterial3(source,sample,options);if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',material,reason:'material-query',parent,query:q});if(q.kind==='outside')continue;
  if(!kept[i]||!kept[i+1])return Object.freeze({kind:'unresolved',material,reason:'inconsistent-closure',parent});const span=Object.freeze({start,end,sample,sampleParameter,location:q.kind});covered.add(i);covered.add(i+1);const previous=pieces.at(-1);if(previous&&previous.last===i){previous.last=i+1;previous.spans.push(span);}else pieces.push({first:i,last:i+1,spans:[span]});
 }
 return Object.freeze({kind:'resolved',material,line,parent,intervals:Object.freeze(pieces.map(p=>Object.freeze({start:events[p.first]!,end:events[p.last]!,spans:Object.freeze(p.spans)}))),isolated:Object.freeze(events.filter((_,i)=>kept[i]&&!covered.has(i)))});
}
