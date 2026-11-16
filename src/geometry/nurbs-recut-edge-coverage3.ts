import {assertOwnedSewnNurbsPlaneSplitFaces3} from './sew-nurbs-plane-split-faces3.js';
import type {SewnNurbsPlaneSplitFaces3,SewnNurbsPlaneSplitEdge3} from './sew-nurbs-plane-split-faces3.js';
import {assertOwnedNurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
import type {NurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
import {matchNurbsRecutSectionEdge3,nurbsRecutEdgeMatchPoint3} from './nurbs-recut-edge-match3.js';
import type {NurbsRecutEdgeMatchCertificate3} from './nurbs-recut-edge-match3.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import {assertOwnedNurbsCapSplitBoundaries3,nurbsCapSplitBoundaryPoint3} from './nurbs-plane-cap-split-boundaries3.js';
import type {NurbsCapSplitBoundaries3} from './nurbs-plane-cap-split-boundaries3.js';
import {intersectPlanes3} from './plane3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {dot3} from './point3.js';
export interface NurbsRecutEdgeCoverageCertificate3 {
 readonly source:Extract<SewnNurbsPlaneSplitFaces3,{kind:'sewn'}>;readonly cells:NurbsSourcePlaneCellComplex3;readonly face:number;
 /** Original sewn edge numbers, increasing native intervals, inherited use. */
 readonly chains:readonly Readonly<{edge:number;curve:Extract<SewnNurbsPlaneSplitEdge3,{kind:'section'}>;direction:1|-1;cuts:readonly AlgebraicReal[];fragments:readonly NurbsRecutEdgeMatchCertificate3[]}>[];
 /** New cell edge -> unique old section match; null leaves original shared
  * boundaries or internal/new section edges to their corresponding pipelines. */
 readonly matches:readonly (NurbsRecutEdgeMatchCertificate3|null)[];
}
export type NurbsRecutEdgeCoverage3=
 | Readonly<{kind:'covered';certificate:NurbsRecutEdgeCoverageCertificate3}>
 | Readonly<{kind:'unresolved';source:SewnNurbsPlaneSplitFaces3;cells:NurbsSourcePlaneCellComplex3;reason:'source-sewing'|'different-region'|'ambiguous-edge'|'orientation'|'gap'|'overlap';edge?:number;cellEdge?:number}>;
const owned=new WeakSet<NurbsRecutEdgeCoverageCertificate3>();
export function assertOwnedNurbsRecutEdgeCoverage3(certificate:NurbsRecutEdgeCoverageCertificate3):void {if(!owned.has(certificate))throw new RangeError('Expected factory-created recut edge coverage');}
/** Every old section incident to this exact finite face must be covered once,
 * in native order, by whole-curve matches of its new boundary edges. No partial
 * table or missing interval acquires a coverage certificate. */
export function coverNurbsRecutSectionEdges3(source:SewnNurbsPlaneSplitFaces3,cells:NurbsSourcePlaneCellComplex3):NurbsRecutEdgeCoverage3 {
 assertOwnedSewnNurbsPlaneSplitFaces3(source);assertOwnedNurbsSourcePlaneCellComplex3(cells);
 const fail=(reason:Extract<NurbsRecutEdgeCoverage3,{kind:'unresolved'}>['reason'],edge?:number,cellEdge?:number):NurbsRecutEdgeCoverage3=>Object.freeze({kind:'unresolved',source,cells,reason,...(edge===undefined?{}:{edge}),...(cellEdge===undefined?{}:{cellEdge})});
 if(source.kind!=='sewn')return fail('source-sewing');const restriction=cells.source.restriction,faces=source.topology.faces.flatMap((f,i)=>f.surface===restriction?[i]:[]);if(restriction===null||faces.length!==1)return fail('different-region');const face=faces[0]!,F=source.topology.faces[face]!,uses=F.loops.flatMap(id=>source.topology.loops[id]!.coedges.map(i=>source.topology.coedges[i]!)),old=uses.filter(u=>source.topology.edges[u.edge]!.curve.kind==='section');
 if(new Set(old.map(u=>u.edge)).size!==old.length)return fail('ambiguous-edge');
 const matches:(NurbsRecutEdgeMatchCertificate3|null)[]=cells.edges.map(()=>null),fragments=new Map(old.map(u=>[u.edge,[] as NurbsRecutEdgeMatchCertificate3[]]));
 for(const [cellEdge,e] of cells.edges.entries())if(e.uses.length===1){
  const found:{edge:number;direction:1|-1;certificate:NurbsRecutEdgeMatchCertificate3}[]=[];
  for(const use of old){const result=matchNurbsRecutSectionEdge3(source.topology.edges[use.edge]!.curve,cells,cellEdge);if(result.kind==='matched')found.push({edge:use.edge,direction:use.direction,certificate:result.certificate});}
  if(found.length>1)return fail('ambiguous-edge',undefined,cellEdge);if(found.length===0)continue;const match=found[0]!;
  if(match.direction!==e.uses[0]!.direction*F.sense)return fail('orientation',match.edge,cellEdge);
  matches[cellEdge]=match.certificate;fragments.get(match.edge)!.push(match.certificate);
 }
 const chains:NurbsRecutEdgeCoverageCertificate3['chains'][number][]=[];
 for(const use of old){const curve=source.topology.edges[use.edge]!.curve;if(curve.kind!=='section')throw new Error('Old section classification changed');const pieces=fragments.get(use.edge)!.sort((a,b)=>a.lower.compare(b.lower));let cursor=curve.lower;const cuts=[cursor];
  for(const piece of pieces){const comparison=piece.lower.compare(cursor);if(comparison!==0)return fail(comparison>0?'gap':'overlap',use.edge,piece.edge);if(piece.upper.compare(piece.lower)<=0)return fail('overlap',use.edge,piece.edge);nurbsRecutEdgeMatchPoint3(piece,piece.lower);nurbsRecutEdgeMatchPoint3(piece,piece.upper);cursor=piece.upper;cuts.push(cursor);}
  if(cursor.compare(curve.upper)!==0)return fail('gap',use.edge);
  chains.push(Object.freeze({edge:use.edge,curve,direction:use.direction,cuts:Object.freeze(cuts),fragments:Object.freeze(pieces)}));
 }
 const certificate=Object.freeze({source,cells,face,chains:Object.freeze(chains),matches:Object.freeze(matches)});owned.add(certificate);return Object.freeze({kind:'covered',certificate});
}
type Cap=Extract<NurbsCapSplitBoundaries3,{kind:'split'}>;
export interface NurbsRecutCapEdgeAlignmentCertificate3 {
 readonly coverage:NurbsRecutEdgeCoverageCertificate3;readonly caps:readonly Cap[];
 readonly chains:readonly Readonly<{edge:number;curve:Extract<SewnNurbsPlaneSplitEdge3,{kind:'section'}>;fragments:readonly Readonly<{lower:AlgebraicReal;upper:AlgebraicReal;sourceMatch:NurbsRecutEdgeMatchCertificate3;cap:Cap;capEdge:number;capSide:1|-1;side:1|-1}>[]}>[];
}
export type NurbsRecutCapEdgeAlignment3=
 | Readonly<{kind:'aligned';certificate:NurbsRecutCapEdgeAlignmentCertificate3}>
 | Readonly<{kind:'unresolved';coverage:NurbsRecutEdgeCoverageCertificate3;reason:'cap-split'|'cap-coverage'|'side'|'orientation';edge?:number}>;
const ownedAlignments=new WeakSet<NurbsRecutCapEdgeAlignmentCertificate3>();
export function assertOwnedNurbsRecutCapEdgeAlignment3(c:NurbsRecutCapEdgeAlignmentCertificate3):void {if(!ownedAlignments.has(c))throw new RangeError('Expected factory-created recut cap edge alignment');}
/** Union source and cap cut parameters on the same original curve. Every new
 * common interval retains both parent fragments; no inverse or geometric
 * endpoint coincidence is used to guess shared ownership. */
export function alignNurbsRecutCapEdges3(coverage:NurbsRecutEdgeCoverageCertificate3,inputs:readonly NurbsCapSplitBoundaries3[]):NurbsRecutCapEdgeAlignment3 {
 assertOwnedNurbsRecutEdgeCoverage3(coverage);const fail=(reason:Extract<NurbsRecutCapEdgeAlignment3,{kind:'unresolved'}>['reason'],edge?:number):NurbsRecutCapEdgeAlignment3=>Object.freeze({kind:'unresolved',coverage,reason,...(edge===undefined?{}:{edge})}),caps:Cap[]=[],surfaces=new Set(),orientations=new Map<Cap,1|-1>();
 for(const c of inputs){assertOwnedNurbsCapSplitBoundaries3(c);if(c.surface.source.boundary.source!==coverage.source)throw new RangeError('Cap belongs to a different old surface assembly');if(intersectPlanes3(c.section.plane,coverage.cells.source.plane).kind!=='coincident')throw new RangeError('Cap uses a different recutting plane');if(surfaces.has(c.surface))throw new RangeError('Duplicate cap surface');surfaces.add(c.surface);if(c.kind!=='split')return fail('cap-split');const orientation=dot3(c.section.plane.normal,coverage.cells.source.plane.normal).sign();if(orientation===0)throw new Error('Coincident plane normals became orthogonal');orientations.set(c,orientation);caps.push(c);}
 const chains:NurbsRecutCapEdgeAlignmentCertificate3['chains'][number][]=[];
 for(const chain of coverage.chains){
  const parts=caps.flatMap(cap=>cap.edges.flatMap((e,capEdge)=>e.curve.kind==='boundary'&&e.curve.source===chain.curve&&e.curve.edge===chain.edge?[{cap,capEdge,curve:e.curve}]:[])).sort((a,b)=>a.curve.lower.compare(b.curve.lower));let cursor=chain.curve.lower;
  for(const p of parts){if(p.curve.lower.compare(cursor)!==0)return fail('cap-coverage',chain.edge);cursor=p.curve.upper;}if(cursor.compare(chain.curve.upper)!==0)return fail('cap-coverage',chain.edge);
  const cuts=[...chain.cuts,...parts.flatMap(p=>[p.curve.lower,p.curve.upper])].sort((a,b)=>a.compare(b)).filter((t,i,all)=>i===0||t.compare(all[i-1]!)!==0),fragments:NurbsRecutCapEdgeAlignmentCertificate3['chains'][number]['fragments'][number][]=[];
  for(let i=0;i+1<cuts.length;i++){
   const lower=cuts[i]!,upper=cuts[i+1]!,sourceMatch=chain.fragments.find(f=>f.lower.compare(lower)<=0&&f.upper.compare(upper)>=0),part=parts.find(p=>p.curve.lower.compare(lower)<=0&&p.curve.upper.compare(upper)>=0);if(!sourceMatch||!part)return fail('cap-coverage',chain.edge);
   const capUses=[...part.cap.negative,...part.cap.positive].flatMap(loop=>loop.filter(u=>u.edge===part.capEdge));if(capUses.length!==1||capUses[0]!.direction!==-chain.direction)return fail('orientation',chain.edge);
   const negative=part.cap.negative.some(loop=>loop.some(u=>u.edge===part.capEdge)),positive=part.cap.positive.some(loop=>loop.some(u=>u.edge===part.capEdge));if(negative===positive)return fail('side',chain.edge);const capSide=positive?1:-1,side=(capSide*orientations.get(part.cap)!) as 1|-1,cellEdge=coverage.cells.edges[sourceMatch.edge]!,sign=coverage.cells.source.cells[cellEdge.uses[0]!.cell]!.sign;if(sign!==side)return fail('side',chain.edge);
   for(const t of [lower,upper])if(compareAlgebraicPoints3(nurbsRecutEdgeMatchPoint3(sourceMatch,t).point,nurbsCapSplitBoundaryPoint3(part.curve,t))!==0)throw new Error('Shared old source/cap curve lost point equality');
   fragments.push(Object.freeze({lower,upper,sourceMatch,cap:part.cap,capEdge:part.capEdge,capSide,side}));
  }
  chains.push(Object.freeze({edge:chain.edge,curve:chain.curve,fragments:Object.freeze(fragments)}));
 }
 const certificate=Object.freeze({coverage,caps:Object.freeze(caps),chains:Object.freeze(chains)});ownedAlignments.add(certificate);return Object.freeze({kind:'aligned',certificate});
}
