import {assertOwnedNurbsRecutParentSectionCoverage3,nurbsRecutParentSectionMatchPoint3} from './nurbs-recut-parent-section-coverage3.js';
import type {NurbsRecutParentSectionCoverageCertificate3,NurbsRecutParentSectionMatchCertificate3} from './nurbs-recut-parent-section-coverage3.js';
import {assertOwnedSewnNurbsRecutCapFaces3,sewnNurbsRecutCapEdgePoint3} from './sew-nurbs-recut-cap-faces3.js';
import type {SewnNurbsRecutCapFaces3} from './sew-nurbs-recut-cap-faces3.js';
import {intersectPlanes3} from './plane3.js';
import {dot3} from './point3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
type Caps=Extract<SewnNurbsRecutCapFaces3,{kind:'sewn'}>;
export interface NurbsRecutParentCapAlignmentCertificate3 {
 readonly coverage:NurbsRecutParentSectionCoverageCertificate3;readonly caps:Caps;
 readonly chains:readonly Readonly<{edge:number;fragments:readonly Readonly<{lower:AlgebraicReal;upper:AlgebraicReal;sourceMatch:NurbsRecutParentSectionMatchCertificate3;capEdge:number;capCoedge:number;side:1|-1}>[]}>[];
}
export type NurbsRecutParentCapAlignment3=
 | Readonly<{kind:'aligned';certificate:NurbsRecutParentCapAlignmentCertificate3}>
 | Readonly<{kind:'unresolved';coverage:NurbsRecutParentSectionCoverageCertificate3;caps:SewnNurbsRecutCapFaces3;reason:'cap-assembly'|'cap-coverage'|'orientation'|'side';edge?:number}>;
const owned=new WeakSet<NurbsRecutParentCapAlignmentCertificate3>();
export function assertOwnedNurbsRecutParentCapAlignment3(c:NurbsRecutParentCapAlignmentCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created parent source/cap alignment');}
/** Union both partitions on the same owned final parent edge. The full native
 * correspondence supplies equality; endpoint checks only audit that lineage. */
export function alignNurbsRecutParentCapEdges3(coverage:NurbsRecutParentSectionCoverageCertificate3,caps:SewnNurbsRecutCapFaces3):NurbsRecutParentCapAlignment3 {
 assertOwnedNurbsRecutParentSectionCoverage3(coverage);assertOwnedSewnNurbsRecutCapFaces3(caps);const fail=(reason:Extract<NurbsRecutParentCapAlignment3,{kind:'unresolved'}>['reason'],edge?:number):NurbsRecutParentCapAlignment3=>Object.freeze({kind:'unresolved',coverage,caps,reason,...(edge===undefined?{}:{edge})});if(caps.source!==coverage.source)throw new RangeError('Source and cap partitions have different closed parents');if(intersectPlanes3(caps.plane,coverage.cells.source.plane).kind!=='coincident')throw new RangeError('Source and cap partitions have different cutting planes');if(caps.kind!=='sewn')return fail('cap-assembly');const orientation=dot3(caps.plane.normal,coverage.cells.source.plane.normal).sign();if(orientation===0)throw new Error('Coincident planes lost normal alignment');
 const chains:NurbsRecutParentCapAlignmentCertificate3['chains'][number][]=[];
 for(const chain of coverage.chains){const ids=caps.sharedFragments[chain.edge]!,parts=ids.map(edge=>({edge,curve:caps.topology.edges[edge]!.curve}));let cursor=chain.curve.lower;
  for(const p of parts){if(p.curve.kind!=='boundary'||p.curve.source!==coverage.source||p.curve.edge!==chain.edge||p.curve.lower.compare(cursor)!==0)return fail('cap-coverage',chain.edge);cursor=p.curve.upper;}if(cursor.compare(chain.curve.upper)!==0)return fail('cap-coverage',chain.edge);
  const cuts=[...chain.cuts,...parts.flatMap(p=>[p.curve.lower,p.curve.upper])].sort((a,b)=>a.compare(b)).filter((t,i,a)=>i===0||t.compare(a[i-1]!)!==0),fragments:NurbsRecutParentCapAlignmentCertificate3['chains'][number]['fragments'][number][]=[];
  for(let i=0;i+1<cuts.length;i++){const lower=cuts[i]!,upper=cuts[i+1]!,sourceMatch=chain.fragments.find(p=>p.lower.compare(lower)<=0&&p.upper.compare(upper)>=0),cap=parts.find(p=>p.curve.lower.compare(lower)<=0&&p.curve.upper.compare(upper)>=0);if(!sourceMatch||!cap)return fail('cap-coverage',chain.edge);const uses=caps.topology.edges[cap.edge]!.coedges;if(uses.length!==1)return fail('cap-coverage',chain.edge);const capCoedge=uses[0]!,h=caps.topology.coedges[capCoedge]!;if(h.direction!==-chain.direction)return fail('orientation',chain.edge);const side=(caps.faceSigns[h.face]!*orientation) as 1|-1,e=coverage.cells.edges[sourceMatch.match.edge]!;if(e.uses.length!==1||coverage.cells.source.cells[e.uses[0]!.cell]!.sign!==side)return fail('side',chain.edge);
   for(const t of [lower,upper])if(compareAlgebraicPoints3(nurbsRecutParentSectionMatchPoint3(sourceMatch,t).point,sewnNurbsRecutCapEdgePoint3(cap.curve,t))!==0)throw new Error('Owned parent source/cap interval lost XYZ equality');fragments.push(Object.freeze({lower,upper,sourceMatch,capEdge:cap.edge,capCoedge,side}));
  }chains.push(Object.freeze({edge:chain.edge,fragments:Object.freeze(fragments)}));
 }
 const certificate=Object.freeze({coverage,caps,chains:Object.freeze(chains)});owned.add(certificate);return Object.freeze({kind:'aligned',certificate});
}
export function nurbsRecutParentCapAlignmentPoint3(c:NurbsRecutParentCapAlignmentCertificate3,chain:number,fragment:number,input:AlgebraicReal|ExactInput){assertOwnedNurbsRecutParentCapAlignment3(c);if(!Number.isSafeInteger(chain)||chain<0||chain>=c.chains.length||!Number.isSafeInteger(fragment)||fragment<0||fragment>=c.chains[chain]!.fragments.length)throw new RangeError('Invalid source/cap fragment index');const f=c.chains[chain]!.fragments[fragment]!,t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);if(t.compare(f.lower)<0||t.compare(f.upper)>0)throw new RangeError('Parameter outside source/cap alignment');const p=nurbsRecutParentSectionMatchPoint3(f.sourceMatch,t);if(compareAlgebraicPoints3(p.point,sewnNurbsRecutCapEdgePoint3(c.caps.topology.edges[f.capEdge]!.curve,t))!==0)throw new Error('Parent source/cap correspondence lost XYZ equality');return p;}
