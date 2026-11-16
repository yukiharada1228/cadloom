import {assertOwnedMaterialSurfaceBoundary3} from './material-surface-boundary3.js';
import type {MaterialSurfaceBoundary3} from './material-surface-boundary3.js';
import {resolveCylinderMaterialProgram3} from './cylinder-material-expression3.js';
import {strictCylinderMaterialProgramLocation3} from './cylinder-material-program3.js';
import {bodyRecordFromMaterialSurfaceBoundary3} from '../convert/material-surface-boundary3.js';
import {assertOwnedCylinderMaterialBoundary3,strictCylinderMaterialLocation3} from './cylinder-material-expression3.js';
import type {CylinderMaterialBoundary3} from './cylinder-material-expression3.js';
import {bodyRecordFromCylinderMaterial3} from '../convert/cylinder-material3.js';
import {assertOwnedClippedCylinderExpression3} from './clipped-cylinder-expression3.js';
import type {ClippedCylinderExpression3} from './clipped-cylinder-expression3.js';
import {bodyRecordFromClippedCylinderExpression3} from '../convert/clipped-cylinder-expression3.js';
import {assertOwnedCylinderExpressionPlaneSplit3} from './cylinder-expression-plane-split3.js';
import type {CylinderExpressionPlaneSplit3} from './cylinder-expression-plane-split3.js';
import {bodyRecordFromCylinderExpressionSplit3} from '../convert/cylinder-expression-split3.js';
import {classifyPointToSurface3} from './surface3.js';
import {assertOwnedFiniteCylinderExpressionBoundary3} from './finite-cylinder-expression3.js';
import type {FiniteCylinderExpressionBoundary3,FiniteCylinderExpression3} from './finite-cylinder-expression3.js';
import {bodyRecordFromFiniteCylinderExpression3} from '../convert/finite-cylinder-expression3.js';
import {Rational} from '../numeric/rational.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import {point3} from './point3.js';
import type {Point3} from './point3.js';
import {normalToSurface3} from './surface3.js';
import {assertOwnedFiniteCylinderBoolean3} from './finite-cylinder-boolean3.js';
import type {FiniteCylinderBoolean3} from './finite-cylinder-boolean3.js';
import {bodyRecordFromFiniteCylinderBoolean3} from '../convert/finite-cylinder-boolean3.js';
import {restoreMixedBRepFaces3,replaceMixedBRepRegions3} from '../convert/mixed-faces3.js';
import type {MixedBRepFaces3} from '../convert/mixed-faces3.js';
import {readBodyRecord3} from '../record/body3.js';
import type {BodyRecord3,BodyRegionRecord3} from '../record/body3.js';
import {intersectMixedBoundaryLine3} from './mixed-shell-ray3.js';
import type {MixedBoundaryRay3} from './mixed-shell-ray3.js';
export interface FiniteCylinderShellRegion3 {
 readonly parent:number|null;readonly depth:number;readonly containers:readonly number[];
 readonly boundedSample:Point3;readonly unboundedSideSample:Point3;
 /** Physical normal points out of this shell's bounded region. Cavities reverse it. */
 readonly outward:boolean;
}
export interface FiniteCylinderBooleanRegions3 {
 readonly source:FiniteCylinderBoolean3;readonly record:BodyRecord3;
 readonly shells:readonly FiniteCylinderShellRegion3[];readonly regions:readonly BodyRegionRecord3[];
 /** One strict sample for each nonvoid bounded region, in region-table order. */
 readonly materialSamples:readonly Point3[];
}
const regionFaces=new WeakMap<object,MixedBRepFaces3>();
/** Internal access requires an actual constructive region result, not a record. */
export function finiteCylinderRegionFaces3(input:FiniteCylinderBooleanRegions3|FiniteCylinderExpressionRegions3|FiniteCylinderExpressionSplitRegions3|ClippedCylinderExpressionRegions3|CylinderMaterialRegions3|MaterialSurfaceRegions3):MixedBRepFaces3 {const faces=regionFaces.get(input);if(!faces)throw new RangeError('Expected factory-created cylinder region analysis');return faces;}
const cache=new WeakMap<FiniteCylinderBoolean3,FiniteCylinderBooleanRegions3>(),two=new Rational(2n),one=new Rational(1n),axes=['x','y','z'] as const;
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {let lo=a,hi=b;while(lo.upper.compare(hi.lower)>=0){lo=lo.refine();hi=hi.refine();}return lo.upper.add(hi.lower).div(two);}
function at(o:Point3,d:Point3,t:Rational):Point3 {return point3(...axes.map(k=>o[k].add(d[k].mul(t))) as [Rational,Rational,Rational]);}
function adjacentSamples(line:MixedBoundaryRay3,index:number,o:Point3,d:Point3):readonly [Point3,Point3] {const h=line.hits[index]!,previous=line.hits[index-1],next=line.hits[index+1],left=previous?between(previous.parameter,h.parameter):h.parameter.lower.sub(one),right=next?between(h.parameter,next.parameter):h.parameter.upper.add(one);return [at(o,d,left),at(o,d,right)];}
function* directions(size:number):Generator<Point3> {for(let x=-size;x<=size;x++)for(let y=-size;y<=size;y++)for(let z=-size;z<=size;z++){if(x===0&&y===0&&z===0||x<0||x===0&&y<0||x===0&&y===0&&z<0)continue;yield point3(BigInt(x),BigInt(y),BigInt(z));}}
/** Lines close to a strict face sample eventually meet that open face. Integer
 * directions become dense; degenerate supporting/edge directions are retried.
 * Termination relies on the owned constructive embedded manifold boundary. */
function probe(input:MixedBRepFaces3,shell:number,acceptSamples:(a:Point3,b:Point3)=>boolean){
 const t=input.boundary.topology,face=t.shells[shell]!.faces[0]!,f=input.faces[face]!;let coordinates=axes.map(k=>f.sample[k]);
 for(let level=0;;level++){
  const origin=point3(...coordinates.map(c=>c.lower.add(c.upper).div(two)) as [Rational,Rational,Rational]);
  for(const direction of directions(1+Math.floor(level/4))){const line=intersectMixedBoundaryLine3(input,origin,direction);if(line.kind==='degenerate')continue;const index=line.hits.findIndex(h=>h.uses[0]!.face===face&&h.uses[0]!.multiplicity===1);if(index<0)continue;
   const after=new Array<boolean>(t.shells.length).fill(false),totals=new Array<number>(t.shells.length).fill(0);
   line.hits.forEach((h,i)=>{const u=h.uses[0]!;if(u.multiplicity!==1)return;const id=t.faces[u.face]!.shell;totals[id]=totals[id]!+1;if(i>index)after[id]=!after[id];});
   if(totals.some(n=>n%2!==0))throw new Error('Closed constructive shell has odd complete-line crossing count');
   const before=[...after];before[shell]=!before[shell];const samples=adjacentSamples(line,index,origin,direction),bounded=before[shell]?samples[0]:samples[1],outside=before[shell]?samples[1]:samples[0],containers=after.flatMap((inside,id)=>id!==shell&&inside?[id]:[]),normal=normalToSurface3(line.hits[index]!.point,f.surface),sign=normal.x.affine(direction.x).add(normal.y.affine(direction.y)).add(normal.z.affine(direction.z)).sign()*f.sense;
   if(!acceptSamples(bounded,outside))continue;if(sign===0)throw new Error('Simple support root has zero physical derivative');const outward=sign>0?before[shell]:after[shell];return {containers,bounded,outside,outward};
  }
  coordinates=coordinates.map(c=>c.refine());
 }
}
/** Constructive finite-cylinder Boolean region adoption only. Generic restored
 * closed incidence is insufficient: arbitrary imported shells are not accepted.
 * Complete support partitions and manifold source selection supply embedding. */
export function finiteCylinderBooleanRegions3(source:FiniteCylinderBoolean3):FiniteCylinderBooleanRegions3 {
 assertOwnedFiniteCylinderBoolean3(source);const known=cache.get(source);if(known)return known;if(!source.manifold)throw new RangeError('Material regions require a manifold finite-cylinder Boolean');
 const ids=source.sewn.topology.shells.map((_,i)=>i),raw=bodyRecordFromFiniteCylinderBoolean3(source,[{shells:ids,void:false}]),data=regionData(raw,p=>source.locate(p),()=>true),result=Object.freeze({source,...data});regionFaces.set(result,regionFaces.get(data)!);cache.set(source,result);return result;
}
export interface FiniteCylinderExpressionRegions3 extends Omit<FiniteCylinderBooleanRegions3,'source'> {readonly source:FiniteCylinderExpressionBoundary3;}
const expressionCache=new WeakMap<FiniteCylinderExpressionBoundary3,FiniteCylinderExpressionRegions3>();
function truth(tree:FiniteCylinderExpression3,values:readonly boolean[]):boolean {if(tree.kind==='operand')return values[tree.operand]!;const a=truth(tree.first,values),b=truth(tree.second,values);switch(tree.kind){case 'union':return a||b;case 'intersection':return a&&b;case 'difference':return a&&!b;case 'xor':return a!==b;}}
/** Membership away from every primitive boundary. Ambiguous witnesses retry;
 * no arbitrary truth value is assigned to a regularized boundary leaf. */
function strictLocation(source:FiniteCylinderExpressionBoundary3,p:Point3):'inside'|'outside'|null {const locations=source.operands.map(c=>c.locate(p));if(locations.includes('boundary'))return null;return truth(source.expression,locations.map(l=>l==='inside'))?'inside':'outside';}
export function finiteCylinderExpressionRegions3(source:FiniteCylinderExpressionBoundary3):FiniteCylinderExpressionRegions3 {
 assertOwnedFiniteCylinderExpressionBoundary3(source);const known=expressionCache.get(source);if(known)return known;if(!source.manifold)throw new RangeError('Material regions require a manifold cylinder expression');
 const ids=source.sewn.topology.shells.map((_,i)=>i),raw=bodyRecordFromFiniteCylinderExpression3(source,[{shells:ids,void:false}]),locate=(p:Point3)=>strictLocation(source,p),data=regionData(raw,locate,(a,b)=>locate(a)!==null&&locate(b)!==null),result=Object.freeze({source,...data});regionFaces.set(result,regionFaces.get(data)!);expressionCache.set(source,result);return result;
}
export interface FiniteCylinderExpressionSplitRegions3 extends Omit<FiniteCylinderBooleanRegions3,'source'> {readonly source:CylinderExpressionPlaneSplit3;readonly side:-1|1;}
const splitCache=new WeakMap<CylinderExpressionPlaneSplit3,Map<-1|1,FiniteCylinderExpressionSplitRegions3>>();
/** Derived regions of one owned manifold cut child; imported incidence and
 * balanced nonmanifold contacts do not acquire material certification. */
export function finiteCylinderExpressionSplitRegions3(source:CylinderExpressionPlaneSplit3,side:-1|1):FiniteCylinderExpressionSplitRegions3 {
 assertOwnedCylinderExpressionPlaneSplit3(source);if(side!==-1&&side!==1)throw new RangeError('Split child side must be -1 or 1');const child=side===-1?source.negative:source.positive;if(!child.manifold)throw new RangeError('Material regions require a manifold plane-cut cylinder expression');
 let bySide=splitCache.get(source);if(!bySide){bySide=new Map();splitCache.set(source,bySide);}const known=bySide.get(side);if(known)return known;
 const ids=child.sewn.topology.shells.map((_,i)=>i),raw=bodyRecordFromCylinderExpressionSplit3(source,side,[{shells:ids,void:false}]),locate=(p:Point3):'inside'|'outside'|null=>{const sign=classifyPointToSurface3(p,{kind:'plane',plane:source.plane});return sign===0?null:sign!==side?'outside':strictLocation(source.source,p);},data=regionData(raw,locate,(a,b)=>locate(a)!==null&&locate(b)!==null),result=Object.freeze({source,side,...data});regionFaces.set(result,regionFaces.get(data)!);bySide.set(side,result);return result;
}
export interface ClippedCylinderExpressionRegions3 extends Omit<FiniteCylinderBooleanRegions3,'source'> {readonly source:ClippedCylinderExpression3;}
const clippedExpressionCache=new WeakMap<ClippedCylinderExpression3,ClippedCylinderExpressionRegions3>();
/** Material certification is restricted to a constructive manifold clipped result. */
export function clippedCylinderExpressionRegions3(source:ClippedCylinderExpression3):ClippedCylinderExpressionRegions3 {
 assertOwnedClippedCylinderExpression3(source);if(!source.manifold)throw new RangeError('Material regions require a manifold clipped cylinder expression');const known=clippedExpressionCache.get(source);if(known)return known;
 const ids=source.sewn.topology.shells.map((_,i)=>i),raw=bodyRecordFromClippedCylinderExpression3(source,[{shells:ids,void:false}]),locate=(p:Point3):'inside'|'outside'|null=>{let ambiguous=false;for(const h of source.halfspaces){const sign=classifyPointToSurface3(p,{kind:'plane',plane:h.plane});if(sign>0)return 'outside';if(sign===0)ambiguous=true;}return ambiguous?null:strictLocation(source.source,p);},data=regionData(raw,locate,(a,b)=>locate(a)!==null&&locate(b)!==null),result=Object.freeze({source,...data});regionFaces.set(result,regionFaces.get(data)!);clippedExpressionCache.set(source,result);return result;
}
export interface CylinderMaterialRegions3 extends Omit<FiniteCylinderBooleanRegions3,'source'> {readonly source:CylinderMaterialBoundary3;}
const materialCache=new WeakMap<CylinderMaterialBoundary3,CylinderMaterialRegions3>();
export function cylinderMaterialRegions3(source:CylinderMaterialBoundary3):CylinderMaterialRegions3 {
 assertOwnedCylinderMaterialBoundary3(source);if(!source.manifold)throw new RangeError('Material regions require a manifold cylinder material boundary');const known=materialCache.get(source);if(known)return known;const ids=source.sewn.topology.shells.map((_,i)=>i),raw=bodyRecordFromCylinderMaterial3(source,[{shells:ids,void:false}]),locate=(p:Point3)=>strictCylinderMaterialLocation3(source,p),data=regionData(raw,locate,(a,b)=>locate(a)!==null&&locate(b)!==null),result=Object.freeze({source,...data});regionFaces.set(result,regionFaces.get(data)!);materialCache.set(source,result);return result;
}
export interface MaterialSurfaceRegions3 extends Omit<FiniteCylinderBooleanRegions3,'source'> {readonly source:MaterialSurfaceBoundary3;}
const surfaceMaterialCache=new WeakMap<MaterialSurfaceBoundary3,MaterialSurfaceRegions3>();
/** Constructive plane/cylinder material family only. Arbitrary restored closed
 * topology cannot enter this path or acquire ownership through a copied object. */
export function materialSurfaceRegions3(source:MaterialSurfaceBoundary3):MaterialSurfaceRegions3 {
 assertOwnedMaterialSurfaceBoundary3(source);
 if(!source.closedOrientedIncidence)throw new RangeError('Material regions require a manifold material surface boundary');
 const known=surfaceMaterialCache.get(source);if(known)return known;
 const program=resolveCylinderMaterialProgram3(source.material),ids=source.sewn.topology.shells.map((_,i)=>i);
 const raw=bodyRecordFromMaterialSurfaceBoundary3(source,[{shells:ids,void:false}]);
 const locate=(p:Point3)=>strictCylinderMaterialProgramLocation3(program,p);
 const data=regionData(raw,locate,(a,b)=>locate(a)!==null&&locate(b)!==null),result=Object.freeze({source,...data});
 regionFaces.set(result,regionFaces.get(data)!);surfaceMaterialCache.set(source,result);return result;
}
/** Private core: public entry points first establish constructive ownership. */
function regionData(raw:BodyRecord3,locate:(p:Point3)=>'inside'|'outside'|'boundary'|null,acceptSamples:(a:Point3,b:Point3)=>boolean){
 const restored=restoreMixedBRepFaces3(raw),t=restored.boundary.topology,ids=t.shells.map((_,i)=>i);
 if(!t.closedOrientedIncidence||t.issues.length)throw new Error('Constructive region boundary is not a closed manifold');const probes=t.shells.map((_,id)=>probe(restored,id,acceptSamples)),depths=probes.map(p=>p.containers.length);
 for(let i=0;i<probes.length;i++)for(const j of probes[i]!.containers){if(j===i||probes[j]!.containers.includes(i)||!probes[j]!.containers.every(k=>probes[i]!.containers.includes(k)))throw new Error('Constructive shell containment is not a strict nesting forest');}
 const parents=probes.map((p,id)=>{const candidates=p.containers.filter(j=>depths[j]===depths[id]!-1);if(!p.containers.length)return null;if(candidates.length!==1)throw new Error('Shell containment has no unique immediate parent');return candidates[0]!;}),children=ids.map(id=>parents.flatMap((p,i)=>p===id?[i]:[]));
 const regions=Object.freeze([Object.freeze({shells:Object.freeze(parents.flatMap((p,i)=>p===null?[i]:[])),void:false}),...ids.map(id=>Object.freeze({shells:Object.freeze([id,...children[id]!]),void:depths[id]!%2===1}))]);
 const shells=Object.freeze(probes.map((p,id)=>{const material=depths[id]!%2===0;if(p.outward!==material||locate(p.bounded)!==(material?'inside':'outside')||locate(p.outside)!==(material?'outside':'inside'))throw new Error('Shell coorientation/material side disagrees with nesting');return Object.freeze({parent:parents[id]!,depth:depths[id]!,containers:Object.freeze(p.containers),boundedSample:p.bounded,unboundedSideSample:p.outside,outward:p.outward});})),materialSamples=Object.freeze(shells.flatMap((s,i)=>regions[i+1]!.void?[]:[s.boundedSample])),record=readBodyRecord3({...raw,regions}),result=Object.freeze({record,shells,regions,materialSamples});regionFaces.set(result,replaceMixedBRepRegions3(restored,regions));return result;
}
