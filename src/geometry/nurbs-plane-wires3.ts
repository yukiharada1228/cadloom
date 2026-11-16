import {assertOwnedSewnNurbsBoundaryPlane3} from './sewn-nurbs-source-boundary-plane3.js';
import type {SewnNurbsBoundaryPlane3} from './sewn-nurbs-source-boundary-plane3.js';
import {prepareAlgebraicCurvePolynomialCuts2} from './algebraic-curve-inequalities2.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
export interface NurbsPlaneWireEdge3 {
 readonly edge:number;readonly direction:1|-1;
 readonly derivative:'u'|'v';readonly derivativeSign:1|-1;
}
export interface NurbsPlaneWire3 {readonly component:number;readonly uses:readonly Readonly<{edge:number;direction:1|-1}>[];}
export interface NurbsPlaneWiresCertificate3 {
 readonly source:Extract<SewnNurbsBoundaryPlane3,{kind:'assembled'}>;
 /** With the plane normal viewed as positive, material lies to the left. */
 readonly edges:readonly NurbsPlaneWireEdge3[];readonly wires:readonly NurbsPlaneWire3[];
}
export type NurbsPlaneWires3=
 | Readonly<{kind:'certified';certificate:NurbsPlaneWiresCertificate3}>
 | Readonly<{kind:'not-certified';source:SewnNurbsBoundaryPlane3;reason:'unresolved-section'|'coplanar-area'|'noncycle-component'|'boundary-span'|'patch-seam'|'vertex-contact'|'nontransverse'|'projection-critical'|'orientation-inconsistent';edge?:number;vertex?:number;component?:number;parameter?:AlgebraicReal}>;
const owned=new WeakSet<NurbsPlaneWiresCertificate3>();
export function assertOwnedNurbsPlaneWires3(c:NurbsPlaneWiresCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created NURBS plane wires certificate');}
/** Sufficient exact certificate for facewise transverse, material-oriented
 * section wires. Rejection preserves all raw section geometry; it does not
 * diagnose an invalid Body. Filling caps and certifying children are separate. */
export function certifyNurbsBoundaryPlaneWires3(source:SewnNurbsBoundaryPlane3):NurbsPlaneWires3 {
 assertOwnedSewnNurbsBoundaryPlane3(source);
 const fail=(reason:Extract<NurbsPlaneWires3,{kind:'not-certified'}>['reason'],extra:Readonly<{edge?:number;vertex?:number;component?:number;parameter?:AlgebraicReal}>={}):NurbsPlaneWires3=>Object.freeze({kind:'not-certified',source,reason,...extra});
 if(source.kind!=='assembled')return fail('unresolved-section');
 if(source.areas.length)return fail('coplanar-area');
 for(const [component,c] of source.components.entries())if(c.cycle===null)return fail('noncycle-component',{component});
 const T=source.material.containment.embedding.source.topology,plane=source.plane,edges:NurbsPlaneWireEdge3[]=[];
 const polynomial=(section:typeof source.edges[number]['section'],patch:number)=>{
  const p=section.complex.source.source.patches[patch]!;
  return p.x.scale(plane.normal.x).add(p.y.scale(plane.normal.y)).add(p.z.scale(plane.normal.z)).add(p.weight.scale(plane.offset));
 };
 for(const [edge,e] of source.edges.entries()){
  if(e.sample.stratum!=='face')return fail('boundary-span',{edge});
  if(e.sample.patches.length!==1)return fail('patch-seam',{edge});
  const part=e.section.edges[e.edge]!,branch=part.graph.edges[part.edge]!,F=polynomial(e.section,part.patch),derivative=branch.kind==='branch'?'v':'u',D=derivative==='v'?F.derivativeV():F.derivativeU(),sign=D.evaluateAlgebraic(e.sample.u,e.sample.v).sign();
  if(sign===0)return fail('nontransverse',{edge});
  // A nonzero branch sample excludes an identically-zero derivative factor.
  // The complete polynomial partition supplies every remaining zero on the
  // native interval, including tangent zeros that do not change sign.
  const cuts=prepareAlgebraicCurvePolynomialCuts2(part.graph,[D])(part.edge,part.lower,part.upper);
  if(cuts.length!==2)return fail('projection-critical',{edge,parameter:cuts[1]!});
  const sense=T.faces[e.face]!.sense,direction=(sense*sign*(derivative==='v'?1:-1)) as 1|-1;
  edges.push(Object.freeze({edge,direction,derivative,derivativeSign:sign}));
 }
 for(const [vertex,v] of source.vertices.entries())for(const use of v.uses){
  const q=use.section.vertices[use.vertex]!;
  if(q.stratum==='vertex')return fail('vertex-contact',{vertex});
  for(const patch of q.patches){const F=polynomial(use.section,patch);if(F.derivativeU().evaluateAlgebraic(q.u,q.v).sign()===0&&F.derivativeV().evaluateAlgebraic(q.u,q.v).sign()===0)return fail('nontransverse',{vertex});}
 }
 const wires:NurbsPlaneWire3[]=[];
 for(const [component,c] of source.components.entries()){
  const cycle=c.cycle!;let uses=cycle.map(u=>({edge:u.edge,direction:u.direction}));
  if(uses[0]!.direction!==edges[uses[0]!.edge]!.direction)uses=uses.reverse().map(u=>({edge:u.edge,direction:(-u.direction) as 1|-1}));
  if(uses.some(u=>u.direction!==edges[u.edge]!.direction))return fail('orientation-inconsistent',{component});
  for(let i=0;i<uses.length;i++){const a=uses[i]!,b=uses[(i+1)%uses.length]!,x=source.edges[a.edge]!,y=source.edges[b.edge]!;if((a.direction===1?x.to:x.from)!==(b.direction===1?y.from:y.to))return fail('orientation-inconsistent',{component});}
  wires.push(Object.freeze({component,uses:Object.freeze(uses.map(u=>Object.freeze(u)))}));
 }
 const certificate=Object.freeze({source,edges:Object.freeze(edges),wires:Object.freeze(wires)});owned.add(certificate);return Object.freeze({kind:'certified',certificate});
}
