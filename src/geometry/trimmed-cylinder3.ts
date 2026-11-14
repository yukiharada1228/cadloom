import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point3,vector3,dot3,cross3,subtract3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3,intersectPlanes3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {algebraicCoordinates3,algebraicPoint3,compareAlgebraicPoints3,snapshotExactPoint3,getPointParameterization3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {evaluatePlaneAtAlgebraicPoint3 as evaluate} from './algebraic-segment-plane3.js';
import {intersectPlaneCylinder3} from './plane-cylinder3.js';
import {intersectLineSurface3} from './surface3.js';
import {prepareCylinderFace3} from './cylinder-face3.js';
import type {PreparedCylinderFace3} from './cylinder-face3.js';
import {intersectPlaneCylinderFace3} from './cylinder-face-section3.js';
import {circle3,circularArc3,pointOnArc3,splitCircularArc3,interiorPointOnArc3} from './circle3.js';
import type {CircularArc3} from './circle3.js';
import {snapshotCurve3,curveEndpoints3,pointOnCurve3,curveOnSurface3,reverseCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
import {witness,orientation,splitBoundary,sectionPieces,traceLoops} from './cylinder-plane-split3.js';
import {buildBRepTopology3} from './brep-topology3.js';
import type {BRepEdgeUse3,BRepTopology3} from './brep-topology3.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';

export interface CylinderHalfSpace3 {readonly plane:Plane3;readonly side:-1|1;}
export interface TrimmedCylinderComponent3 {
  /** Closed angular cells; their open feasible fibers form one connected interior. */
  readonly angularCells:readonly CircularArc3[];
  readonly sample:AlgebraicCoordinates3;
  readonly uses:readonly BRepEdgeUse3[];
  readonly loops:readonly (readonly BRepEdgeUse3[])[]|null;
  locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
export interface PreparedTrimmedCylinder3 {
  readonly base:PreparedCylinderFace3;
  /** Normalized oriented planes; all are represented as negative-side constraints. */
  readonly halfspaces:readonly CylinderHalfSpace3[];
  readonly empty:boolean;
  readonly edges:readonly Curve3[];
  readonly components:readonly TrimmedCylinderComponent3[];
  locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
export interface TrimmedCylinderPlaneSplit3 {
  readonly negative:PreparedTrimmedCylinder3;
  readonly positive:PreparedTrimmedCylinder3;
  readonly edges:readonly Curve3[];
  readonly negativeUses:readonly BRepEdgeUse3[];
  readonly positiveUses:readonly BRepEdgeUse3[];
  readonly sharedEdges:readonly number[];
  /** One incidence face per connected component, when all loops are unambiguous. */
  readonly topology:BRepTopology3|null;
  readonly topologyFaces:Readonly<{negative:readonly number[];positive:readonly number[]}>;
}
interface Owned {base:PreparedCylinderFace3;planes:readonly Plane3[];}
const owned=new WeakMap<PreparedTrimmedCylinder3,Owned>();
const axes=['x','y','z'] as const,one=new Rational(1n),two=new Rational(2n);
const same=(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3)=>compareAlgebraicPoints3(a,b)===0;
const unique=(points:readonly AlgebraicCoordinates3[])=>points.filter((p,i,all)=>all.findIndex(q=>same(p,q))===i);
function negate(p:Plane3):Plane3{return plane3(p.normal.x.neg(),p.normal.y.neg(),p.normal.z.neg(),p.offset.neg());}
function normalize(input:Plane3):Plane3 {
  const p=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),pivot=axes.map(k=>p.normal[k]).find(x=>x.sign()!==0)!,scale=one.div(pivot.sign()<0?pivot.neg():pivot);
  return plane3(p.normal.x.mul(scale),p.normal.y.mul(scale),p.normal.z.mul(scale),p.offset.mul(scale));
}
function key(p:Plane3):string{return [p.normal.x,p.normal.y,p.normal.z,p.offset].map(x=>x.toString()).join(',');}
function project(base:PreparedCylinderFace3,input:AlgebraicCoordinates3):AlgebraicCoordinates3 {
  const p=snapshotExactPoint3(input),o=base.surface.axis.origin,d=base.surface.axis.direction,D=dot3(d,d),data=getPointParameterization3(p),scale=(t:Rational)=>vector3(d.x.mul(t),d.y.mul(t),d.z.mul(t));
  if(data)return algebraicPoint3(subtract3(data.origin,scale(dot3(subtract3(data.origin,o),d).div(D))),subtract3(data.direction,scale(dot3(data.direction,d).div(D))),data.parameter);
  const t=evaluate(plane3(d.x,d.y,d.z,dot3(o,d).neg()),p).affine(one.div(D));
  return algebraicCoordinates3(...axes.map(k=>p[k].sub(t.affine(d[k]))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);
}
interface Bound {value:AlgebraicReal;constant:Rational;coefficient:Rational;}
interface Fiber {lower:Bound;upper:Bound;nonempty:boolean;}
function fiber(base:PreparedCylinderFace3,planes:readonly Plane3[],p:AlgebraicCoordinates3):Fiber {
  const data=getPointParameterization3(p),d=base.surface.axis.direction;
  let lower:Bound={value:AlgebraicReal.fromRational(base.lower),constant:base.lower,coefficient:new Rational(0n)},upper:Bound={value:AlgebraicReal.fromRational(base.upper),constant:base.upper,coefficient:new Rational(0n)};
  for(const plane of planes){
    const a=dot3(plane.normal,d),b=evaluate(plane,p);
    if(a.sign()===0){if(b.sign()>=0)return {lower,upper,nonempty:false};continue;}
    const coefficient=data?dot3(plane.normal,data.direction).neg().div(a):new Rational(0n),constant=data?dot3(plane.normal,data.origin).add(plane.offset).neg().div(a):new Rational(0n),bound:Bound={value:data?data.parameter.affine(coefficient,constant):b.affine(one.neg().div(a)),constant,coefficient};
    if(a.sign()>0){if(bound.value.compare(upper.value)<0)upper=bound;}
    else if(bound.value.compare(lower.value)>0)lower=bound;
  }
  return {lower,upper,nonempty:lower.value.compare(upper.value)<0};
}
function sampleAt(base:PreparedCylinderFace3,p:AlgebraicCoordinates3,f:Fiber):AlgebraicCoordinates3 {
  const data=getPointParameterization3(p),d=base.surface.axis.direction;
  if(data){const a=f.lower.coefficient.add(f.upper.coefficient).div(two),b=f.lower.constant.add(f.upper.constant).div(two);return algebraicPoint3(point3(data.origin.x.add(d.x.mul(b)),data.origin.y.add(d.y.mul(b)),data.origin.z.add(d.z.mul(b))),vector3(data.direction.x.add(d.x.mul(a)),data.direction.y.add(d.y.mul(a)),data.direction.z.add(d.z.mul(a))),data.parameter);}
  const t=f.lower.value.add(f.upper.value).affine('1/2');return algebraicCoordinates3(...axes.map(k=>p[k].add(t.affine(d[k]))) as [AlgebraicReal,AlgebraicReal,AlgebraicReal]);
}
interface ComponentSeed {cells:CircularArc3[];sample:AlgebraicCoordinates3;}
function angularComponents(base:PreparedCylinderFace3,planes:readonly Plane3[]):ComponentSeed[] {
  const o=base.surface.axis.origin,d=base.surface.axis.direction,D=dot3(d,d),at=(t:Rational)=>plane3(d.x,d.y,d.z,dot3(d,o).add(D.mul(t)).neg()),all=[...planes,at(base.lower),at(base.upper)],cuts:AlgebraicCoordinates3[]=[];
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
    const line=intersectPlanes3(all[i]!,all[j]!);if(line.kind!=='line')continue;
    const hit=intersectLineSurface3(line.line,{kind:'cylinder',cylinder:base.surface});
    if(hit.kind==='points')cuts.push(...hit.hits.map(h=>project(base,h.point)));
    else if(hit.kind==='contained')cuts.push(project(base,algebraicCoordinates3(line.line.origin.x,line.line.origin.y,line.line.origin.z)));
  }
  const C=circle3(o,d,base.surface.radiusSquared),u=d.y.sign()!==0||d.z.sign()!==0?cross3(d,vector3(1n,0n,0n)):cross3(d,vector3(0n,1n,0n)),v=cross3(d,u);
  for(const ray of [u,v,vector3(u.x.neg(),u.y.neg(),u.z.neg()),vector3(v.x.neg(),v.y.neg(),v.z.neg())])cuts.push(algebraicPoint3(C.center,ray,AlgebraicReal.fromRational(C.radiusSquared.div(dot3(ray,ray))).sqrt()));
  const cells=splitCircularArc3(base.angular,unique(cuts).filter(p=>pointOnArc3(p,base.angular))),samples=cells.map(c=>interiorPointOnArc3(c)),fibers=samples.map(p=>fiber(base,planes,p)),parents=cells.map((_,i)=>i),find=(i:number):number=>parents[i]===i?i:(parents[i]=find(parents[i]!));
  for(let i=0;i<cells.length;i++){
    const j=(i+1)%cells.length;if(j===0&&!base.angular.fullCircle)continue;
    if(fibers[i]!.nonempty&&fibers[j]!.nonempty&&fiber(base,planes,cells[i]!.end).nonempty)parents[find(j)]=find(i);
  }
  const groups=new Map<number,ComponentSeed>();
  cells.forEach((cell,i)=>{if(!fibers[i]!.nonempty)return;const id=find(i),group=groups.get(id);if(group)group.cells.push(cell);else groups.set(id,{cells:[cell],sample:sampleAt(base,samples[i]!,fibers[i]!)});});
  return [...groups.values()];
}
function sameCurve(a:Curve3,b:Curve3):1|-1|0 {
  const A=curveEndpoints3(a),B=curveEndpoints3(b),direction=same(A[0],B[0])&&same(A[1],B[1])?1:same(A[0],B[1])&&same(A[1],B[0])?-1:0;
  if(!direction)return 0;
  if(a.kind==='algebraic-segment'&&b.kind==='algebraic-segment')return direction;
  if(a.kind!==b.kind)return 0;
  return pointOnCurve3(witness(a),b)&&pointOnCurve3(witness(b),a)?direction:0;
}
/** Construct the regularized intersection of a finite cylinder product domain
 * with finitely many rational halfspaces; connected interiors are extracted.
 */
export function prepareTrimmedCylinder3(input:PreparedCylinderFace3,halfspaces:readonly CylinderHalfSpace3[]=[]):PreparedTrimmedCylinder3 {
  const base=prepareCylinderFace3(input.surface,input.lower,input.upper,{angular:input.angular,sense:input.sense}),records=new Map<string,Plane3>();
  for(const h of halfspaces){if(h.side!==-1&&h.side!==1)throw new RangeError('Halfspace side must be -1 or +1');const p=normalize(h.side===-1?h.plane:negate(h.plane));records.set(key(p),p);}
  const planes=[...records.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,p])=>p),active:Plane3[]=[];let impossible=false;
  for(const p of planes){
    if(records.has(key(negate(p))))impossible=true;
    const support=intersectPlaneCylinder3(p,base.surface);
    if(support.kind==='none'||support.kind==='lines'&&support.lines.length===1){if(dot3(p.normal,base.surface.axis.origin).add(p.offset).sign()>0)impossible=true;}
    else active.push(p);
  }
  const seeds=impossible?[]:angularComponents(base,active),candidates:Curve3[]=[],edges:Curve3[]=[];
  if(seeds.length){
    for(const loop of base.boundary)for(const boundary of loop){let pieces:readonly Curve3[]=[boundary];for(const p of active)pieces=pieces.flatMap(c=>splitBoundary(c,p));candidates.push(...pieces);}
    for(const p of active){
      const section=intersectPlaneCylinderFace3(p,base);
      for(const item of section.curves)if(item.multiplicity===1)for(const part of sectionPieces(item.curve)){
        let pieces:readonly Curve3[]=[part];for(const q of active)pieces=pieces.flatMap(c=>splitBoundary(c,q));
        for(const c of pieces){const point=witness(c);if(base.locate(point)!=='inside')continue;const sign=orientation(c,point,base,p);if(sign===0)throw new Error('Trim boundary orientation is zero');candidates.push(sign===1?c:reverseCurve3(c));}
      }
    }
    for(const c of candidates){
      const point=witness(c);let keep=true;
      for(const p of active){
        const sign=evaluate(p,point).sign();if(sign>0){keep=false;break;}
        if(sign===0){
          if(!curveOnSurface3(c,{kind:'plane',plane:p}))throw new Error('Trim boundary cell was not completely noded');
          const inward=-orientation(c,point,base,p);if(inward>=0){keep=false;break;}
        }
      }
      if(keep&&!edges.some(e=>sameCurve(c,e)!==0))edges.push(snapshotCurve3(c));
    }
    if(!edges.length)throw new Error('A nonempty trimmed cylinder component has no boundary');
  }
  const table=Object.freeze(edges),publicHalfspaces=Object.freeze(planes.map(plane=>Object.freeze({plane,side:-1 as const}))),empty=seeds.length===0;
  const locate:PreparedTrimmedCylinder3['locate']=inputPoint=>{
    const p=snapshotExactPoint3(inputPoint),position=base.locate(p);if(empty||position==='outside')return 'outside';let boundary=false;
    for(const plane of active){const sign=evaluate(plane,p).sign();if(sign>0)return 'outside';if(sign===0)boundary=true;}
    return boundary?table.some(c=>pointOnCurve3(p,c))?'boundary':'outside':position;
  };
  const componentUses=seeds.map(()=>[] as BRepEdgeUse3[]);
  table.forEach((curve,edge)=>{
    const p=project(base,witness(curve)),ids=seeds.flatMap((seed,i)=>seed.cells.some(c=>pointOnArc3(p,c))?[i]:[]);
    if(ids.length!==1)throw new Error('Positive-length boundary cell has ambiguous angular component ownership');
    componentUses[ids[0]!]!.push(Object.freeze({edge,direction:1}));
  });
  const components=Object.freeze(seeds.map((seed,i)=>{
    const angularCells=Object.freeze(seed.cells),uses=Object.freeze(componentUses[i]!);
    const component:TrimmedCylinderComponent3=Object.freeze({angularCells,sample:seed.sample,uses,loops:traceLoops(table,uses),locate:(inputPoint:Point3|AlgebraicCoordinates3)=>{const p=snapshotExactPoint3(inputPoint),position=locate(p);return position!=='outside'&&angularCells.some(c=>pointOnArc3(project(base,p),c))?position:'outside';}});
    if(component.locate(component.sample)!=='inside')throw new Error('Trim component sample is not in its relative interior');return component;
  }));
  const result=Object.freeze({base,halfspaces:publicHalfspaces,empty,edges:table,components,locate});owned.set(result,{base,planes});return result;
}
/** Extract one connected interior as a reusable factory-owned trimmed domain.
 * Component closures may share contact points; no positive-area material is added.
 */
export function extractTrimmedCylinderComponent3(input:PreparedTrimmedCylinder3,index:number):PreparedTrimmedCylinder3 {
  const data=owned.get(input);if(!data)throw new RangeError('Component extraction requires a factory-created trimmed domain');
  if(!Number.isSafeInteger(index)||index<0||index>=input.components.length)throw new RangeError('Invalid trimmed-cylinder component index');
  if(input.components.length===1)return input;
  const cells=input.components[index]!.angularCells,first=cells.filter(c=>!cells.some(other=>same(other.end,c.start))),last=cells.filter(c=>!cells.some(other=>same(other.start,c.end)));
  if(first.length!==1||last.length!==1)throw new Error('A proper angular component must have two distinct interval ends');
  const angular=circularArc3(data.base.angular.circle,first[0]!.start,last[0]!.end,{direction:'ccw'}),base=prepareCylinderFace3(data.base.surface,data.base.lower,data.base.upper,{angular,sense:data.base.sense}),result=prepareTrimmedCylinder3(base,data.planes.map(plane=>({plane,side:-1})));
  if(result.components.length!==1)throw new Error('Extracted angular component does not have one connected interior');return result;
}
/** Re-split a factory-owned trimmed cylinder region. Every component remains
 * reusable, and true shared cut pieces have common IDs/opposite coedge uses.
 */
export function splitTrimmedCylinderByPlane3(input:PreparedTrimmedCylinder3,inputPlane:Plane3):TrimmedCylinderPlaneSplit3 {
  const data=owned.get(input);if(!data)throw new RangeError('Trimmed cylinder splitting requires a factory-created domain');
  const plane=plane3(inputPlane.normal.x,inputPlane.normal.y,inputPlane.normal.z,inputPlane.offset),old=data.planes.map(plane=>({plane,side:-1 as const})),negative=prepareTrimmedCylinder3(data.base,[...old,{plane,side:-1}]),positive=prepareTrimmedCylinder3(data.base,[...old,{plane,side:1}]),edges:Curve3[]=[],uses:{negative:BRepEdgeUse3[];positive:BRepEdgeUse3[]}={negative:[],positive:[]},maps:{negative:BRepEdgeUse3[];positive:BRepEdgeUse3[]}={negative:[],positive:[]};
  for(const [name,region] of [['negative',negative],['positive',positive]] as const)region.edges.forEach(c=>{
    let edge=edges.findIndex(e=>sameCurve(c,e)!==0),direction:1|-1=1;
    if(edge<0){edge=edges.length;edges.push(c);}else direction=sameCurve(c,edges[edge]!) as 1|-1;
    const use=Object.freeze({edge,direction});uses[name].push(use);maps[name].push(use);
  });
  const shared=uses.negative.filter(a=>uses.positive.some(b=>b.edge===a.edge)).map(a=>a.edge);
  for(const edge of shared)if(uses.negative.find(u=>u.edge===edge)!.direction===uses.positive.find(u=>u.edge===edge)!.direction)throw new Error('Shared trim boundaries must have opposite physical directions');
  const faces:{surface:{kind:'cylinder';cylinder:PreparedCylinderFace3['surface']};sense:1|-1;loops:readonly (readonly BRepEdgeUse3[])[]}[]=[],ids:{negative:number[];positive:number[]}={negative:[],positive:[]};let topology:BRepTopology3|null=null;
  if([...negative.components,...positive.components].every(c=>c.loops!==null)){
    for(const [name,region] of [['negative',negative],['positive',positive]] as const)for(const component of region.components){ids[name].push(faces.length);faces.push({surface:{kind:'cylinder',cylinder:data.base.surface},sense:data.base.sense,loops:component.loops!.map(loop=>loop.map(u=>maps[name][u.edge]!))});}
    topology=buildBRepTopology3(edges,faces);
  }
  return Object.freeze({negative,positive,edges:Object.freeze(edges),negativeUses:Object.freeze(uses.negative),positiveUses:Object.freeze(uses.positive),sharedEdges:Object.freeze(shared),topology,topologyFaces:Object.freeze({negative:Object.freeze(ids.negative),positive:Object.freeze(ids.positive)})});
}
