import {line3,intersectLineSurface3} from './surface3.js';
import type {Point3,Vector3} from './point3.js';
import {point3} from './point3.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedMixedBRepFaces3} from '../convert/mixed-faces3.js';
import type {MixedBRepFaces3} from '../convert/mixed-faces3.js';
export interface MixedRayFaceUse3 {readonly face:number;readonly location:'inside'|'boundary';readonly multiplicity:1|2;}
export interface MixedBoundaryRayHit3 {readonly parameter:AlgebraicReal;readonly point:AlgebraicCoordinates3;readonly uses:readonly MixedRayFaceUse3[];}
export interface MixedBoundaryRay3 {
 readonly kind:'regular'|'degenerate';readonly hits:readonly MixedBoundaryRayHit3[];
 /** Supporting-surface containment is conservatively degenerate, even when its
  * bounded domain might not overlap the forward ray. */
 readonly containedSupports:readonly number[];
}
function faceIds(input:MixedBRepFaces3,shell:number|undefined):readonly number[] {
 assertOwnedMixedBRepFaces3(input);if(shell===undefined)return input.faces.map((_,i)=>i);if(!Number.isSafeInteger(shell)||shell<0||shell>=input.boundary.topology.shells.length)throw new RangeError('Invalid mixed shell index');return input.boundary.topology.shells[shell]!.faces;
}
/** Exact finite forward-ray hits filtered against validated bounded domains.
 * Shared edges/vertices, duplicate face interiors and contained supports request
 * another ray; no arbitrary half-open edge ownership rule is invented. */
export function intersectMixedBoundaryRay3(input:MixedBRepFaces3,origin:Point3,direction:Vector3,shell?:number):MixedBoundaryRay3 {
 return intersectMixedLine(input,origin,direction,shell,true);
}
/** Exact two-sided line events, retaining negative parameters for region scans. */
export function intersectMixedBoundaryLine3(input:MixedBRepFaces3,origin:Point3,direction:Vector3,shell?:number):MixedBoundaryRay3 {return intersectMixedLine(input,origin,direction,shell,false);}
function intersectMixedLine(input:MixedBRepFaces3,origin:Point3,direction:Vector3,shell:number|undefined,forward:boolean):MixedBoundaryRay3 {
 const ids=faceIds(input,shell),line=line3(origin,direction),containedSupports:number[]=[],groups:{parameter:AlgebraicReal;point:AlgebraicCoordinates3;uses:MixedRayFaceUse3[]}[]=[];
 for(const face of ids){const f=input.faces[face]!,hit=intersectLineSurface3(line,f.surface);if(hit.kind==='contained'){containedSupports.push(face);continue;}if(hit.kind!=='points')continue;
  for(const h of hit.hits){if(forward&&h.parameter.sign()<0)continue;const location=f.locate(h.point);if(location==='outside')continue;const use=Object.freeze({face,location,multiplicity:h.multiplicity as 1|2}),existing=groups.find(g=>g.parameter.compare(h.parameter)===0);if(existing)existing.uses.push(use);else groups.push({parameter:h.parameter,point:h.point,uses:[use]});}
 }
 groups.sort((a,b)=>a.parameter.compare(b.parameter));const hits=Object.freeze(groups.map(g=>Object.freeze({...g,uses:Object.freeze(g.uses)}))),degenerate=containedSupports.length>0||hits.some(h=>h.uses.length!==1||h.uses[0]!.location==='boundary');return Object.freeze({kind:degenerate?'degenerate':'regular',hits,containedSupports:Object.freeze(containedSupports)});
}
export type MixedShellPointLocation3=
 | {readonly kind:'boundary';readonly faces:readonly number[]}
 | {readonly kind:'regular';readonly location:'inside'|'outside';readonly crossings:number;readonly ray:MixedBoundaryRay3}
 | {readonly kind:'retry';readonly ray:MixedBoundaryRay3};
/** Even/odd query for a closed locally manifold shell, using a caller-selected
 * rational direction. A degenerate ray is explicit; this is not a global shell
 * embedding/material certificate. Tangent double roots do not change parity. */
export function locatePointInMixedShell3(input:MixedBRepFaces3,shell:number,origin:Point3,direction:Vector3=point3(1n,0n,0n)):MixedShellPointLocation3 {
 const ids=faceIds(input,shell),s=input.boundary.topology.shells[shell]!;if(!s.closedOrientedIncidence)throw new RangeError('Mixed shell parity requires closed oriented locally manifold incidence');const p=point3(origin.x,origin.y,origin.z),boundary=ids.filter(i=>input.faces[i]!.locate(p)!=='outside');if(boundary.length)return Object.freeze({kind:'boundary',faces:Object.freeze(boundary)});
 const ray=intersectMixedBoundaryRay3(input,p,direction,shell);if(ray.kind==='degenerate')return Object.freeze({kind:'retry',ray});const crossings=ray.hits.filter(h=>h.uses[0]!.multiplicity===1).length;return Object.freeze({kind:'regular',location:crossings%2===1?'inside':'outside',crossings,ray});
}
