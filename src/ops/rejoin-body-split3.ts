import {assertOwnedBodyPlaneSplit3} from './body-plane-split3.js';
import type {BodyPlaneSplit3} from './body-plane-split3.js';
import {bodySplitInterface3,bodySplitFacePatch3} from './body-split-interface3.js';
import {booleanMaterialBodies3} from './body3.js';
import {rejoinPlanarBodySplit3} from './planar-body-split3.js';
import type {KernelBody3} from '../model/body3.js';
import {sewMixedBRepFaces3} from '../geometry/sew-mixed-brep3.js';
import type {SewnMixedBRep3} from '../geometry/sew-mixed-brep3.js';

export interface RejoinedBodyPlaneSplit3 {
 /** Independently constructed union material, with its own validated boundary. */
 readonly body:KernelBody3;
 /** Actual child outer patches after cancelling only the owned new interface.
  * Its subdivisions and face IDs may differ from body.topology. */
 readonly sewing:SewnMixedBRep3;
 /** Sewing face index -> original side and actual child face index. The nested
  * sewing.sourceUses maps each of that face's input coedges to sewn edge atoms. */
 readonly faces:readonly Readonly<{side:-1|1;face:number}>[];
}
const cache=new WeakMap<BodyPlaneSplit3,RejoinedBodyPlaneSplit3>();
/** Inverse of an owned common plane split. Cancels its verified finite cap
 * groups, re-sews the retained child patches and independently builds the union.
 * Does not grant arbitrary sewn imports a Body material certificate. */
export function rejoinBodyPlaneSplit3(split:BodyPlaneSplit3):RejoinedBodyPlaneSplit3 {
 assertOwnedBodyPlaneSplit3(split);const known=cache.get(split);if(known)return known;
 const section=bodySplitInterface3(split),faces:{side:-1|1;face:number}[]=[],patches:ReturnType<typeof bodySplitFacePatch3>[]=[];
 for(const [side,body,caps] of [[-1,split.negative,section.negativeFaces],[1,split.positive,section.positiveFaces]] as const){
  const removed=new Set(caps);for(const [face] of body.topology.faces.entries())if(!removed.has(face)){faces.push(Object.freeze({side,face}));patches.push(bodySplitFacePatch3(body,face));}
 }
 const sewing=sewMixedBRepFaces3(patches,{requireClosed:split.representation==='surface-material'});
 for(const edge of sewing.topology.edges)if(edge.coedges.length<2||edge.coedges.reduce((sum,id)=>sum+sewing.topology.coedges[id]!.direction,0)!==0)throw new Error('Rejoined child outer boundary has an open or unbalanced edge');
 const body=split.representation==='planar'?rejoinPlanarBodySplit3(split.planar):booleanMaterialBodies3(split.negative,split.positive,'union');
 const result=Object.freeze({body,sewing,faces:Object.freeze(faces)});cache.set(split,result);return result;
}
