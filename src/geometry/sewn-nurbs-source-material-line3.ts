import {Rational} from '../numeric/rational.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import {point3} from './point3.js';
import type {Point3} from './point3.js';
import {line3} from './surface3.js';
import type {Line3} from './surface3.js';
import {assertOwnedSewnNurbsSourceMaterial3} from './sewn-nurbs-source-material3.js';
import type {SewnNurbsSourceMaterialCertificate3} from './sewn-nurbs-source-material3.js';
import {intersectSewnNurbsSourceLine3} from './sewn-nurbs-source-ray3.js';
import type {SewnNurbsSourceRay3} from './sewn-nurbs-source-ray3.js';
import {locateSewnNurbsSourceMaterial3} from './sewn-nurbs-source-material-query3.js';
import type {SewnNurbsMaterialLocation3} from './sewn-nurbs-source-material-query3.js';
import type {SewnNurbsParitySearchOptions3} from './sewn-nurbs-source-parity-search3.js';

type ResolvedBoundary=Exclude<SewnNurbsSourceRay3,{kind:'unresolved'}>;
export type SewnNurbsMaterialLineHit3=ResolvedBoundary['hits'][number];
export interface SewnNurbsMaterialLineSpan3 {
 readonly start:SewnNurbsMaterialLineHit3;
 readonly end:SewnNurbsMaterialLineHit3;
 readonly sample:Point3;
 readonly sampleParameter:Rational;
 /** Location of the open parameter interval, not of its closed endpoints. */
 readonly location:'inside'|'boundary';
}
export interface SewnNurbsMaterialLineInterval3 {
 readonly start:SewnNurbsMaterialLineHit3;
 readonly end:SewnNurbsMaterialLineHit3;
 readonly spans:readonly SewnNurbsMaterialLineSpan3[];
}
export type SewnNurbsMaterialLine3=
 | Readonly<{kind:'resolved';boundary:ResolvedBoundary;intervals:readonly SewnNurbsMaterialLineInterval3[];isolated:readonly SewnNurbsMaterialLineHit3[]}>
 | Readonly<{kind:'unresolved';reason:'boundary-section';boundary:Extract<SewnNurbsSourceRay3,{kind:'unresolved'}>}>
 | Readonly<{kind:'unresolved';reason:'material-query';boundary:ResolvedBoundary;query:Extract<SewnNurbsMaterialLocation3,{kind:'unresolved'}>;between:readonly [number,number]}>;
function strictlyBetween(a:AlgebraicReal,b:AlgebraicReal):Rational {
 if(a.compare(b)>=0)throw new Error('Material line events must be strictly ordered');
 while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}
 return a.upper.add(b.lower).div(new Rational(2n));
}
/** Closed material intersection with the complete rational line. Tangency,
 * seams and boundary-contained spans retain their exact event provenance;
 * no arbitrary crossing convention is used to assign material. */
export function intersectSewnNurbsSourceMaterialLine3(material:SewnNurbsSourceMaterialCertificate3,input:Line3,options:SewnNurbsParitySearchOptions3={}):SewnNurbsMaterialLine3 {
 assertOwnedSewnNurbsSourceMaterial3(material);
 const line=line3(input.origin,input.direction),boundary=intersectSewnNurbsSourceLine3(material.containment.embedding.source,line);
 if(boundary.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'boundary-section',boundary});
 const hits=boundary.hits,covered=new Set<number>(),pieces:{first:number;last:number;spans:SewnNurbsMaterialLineSpan3[]}[]=[];
 for(let i=0;i+1<hits.length;i++){
  const start=hits[i]!,end=hits[i+1]!,sampleParameter=strictlyBetween(start.parameter,end.parameter),sample=point3(line.origin.x.add(line.direction.x.mul(sampleParameter)),line.origin.y.add(line.direction.y.mul(sampleParameter)),line.origin.z.add(line.direction.z.mul(sampleParameter))),query=locateSewnNurbsSourceMaterial3(material,sample,options);
  if(query.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:'material-query',boundary,query,between:Object.freeze([i,i+1] as const)});
  if(query.kind==='outside')continue;
  const span=Object.freeze({start,end,sample,sampleParameter,location:query.kind});
  covered.add(i);covered.add(i+1);const previous=pieces.at(-1);
  if(previous&&previous.last===i){previous.last=i+1;previous.spans.push(span);}else pieces.push({first:i,last:i+1,spans:[span]});
 }
 // Every event lies on the certified closed material boundary. An event
 // not incident to a retained span is an isolated closed-set intersection.
 const intervals=Object.freeze(pieces.map(p=>Object.freeze({start:hits[p.first]!,end:hits[p.last]!,spans:Object.freeze(p.spans)}))),isolated=Object.freeze(hits.filter((_,i)=>!covered.has(i)));
 return Object.freeze({kind:'resolved',boundary,intervals,isolated});
}
