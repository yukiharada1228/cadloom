import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {algebraicPoint2} from './algebraic-point2.js';
import {point2} from './point2.js';
import {mapPlanePoint3} from './plane-frame3.js';
import {point3,vector3,dot3,cross3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {algebraicCoordinates3,snapshotExactPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {pointInPlaneFrame3} from './plane-frame3.js';
import type {PlaneFrame3} from './plane-frame3.js';
import {algebraicSegment3} from './algebraic-segment3.js';
import {intersectAlgebraicSegmentPlane3} from './algebraic-segment-plane3.js';
import {intersectAlgebraicSegmentEllipse3} from './ellipse3.js';
import {curveEndpoints3,pointOnCurve3,curveOnSurface3,snapshotCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
import {translatePlanarFace3} from './planar-face3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';
import {segmentCross} from './planar-cylinder-intersection3.js';
import {witness,splitBoundary,traceLoops} from './cylinder-plane-split3.js';
import {chartGeometry,verticalPieces,duals,map,mapQ,real,uniqueReals,samePoint,zero,one,two} from './planar-trim-utils3.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';
import {buildBRepTopology3} from './brep-topology3.js';
import type {BRepEdgeUse3,BRepTopology3} from './brep-topology3.js';

export interface PlanarHalfSpace3 {readonly plane:Plane3;readonly side:-1|1;}
export interface TrimmedPlanarComponent3 {
  readonly sample:AlgebraicCoordinates3;
  readonly uses:readonly BRepEdgeUse3[];
  readonly loops:readonly (readonly BRepEdgeUse3[])[]|null;
  locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
export interface PreparedTrimmedPlanar3 {
  readonly base:PreparedPlanarFace3;
  readonly frame:PlaneFrame3;
  readonly halfspaces:readonly PlanarHalfSpace3[];
  readonly empty:boolean;
  readonly edges:readonly Curve3[];
  readonly components:readonly TrimmedPlanarComponent3[];
  locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
export type TrimmedPlanarSplit3=
 | {readonly kind:'coplanar';readonly region:PreparedTrimmedPlanar3}
 | {readonly kind:'split';readonly negative:PreparedTrimmedPlanar3;readonly positive:PreparedTrimmedPlanar3;readonly edges:readonly Curve3[];readonly negativeUses:readonly BRepEdgeUse3[];readonly positiveUses:readonly BRepEdgeUse3[];readonly sharedEdges:readonly number[];readonly topology:BRepTopology3|null;readonly topologyFaces:Readonly<{negative:readonly number[];positive:readonly number[]}>};
interface LocalPlane {a:Rational;b:Rational;c:Rational;plane:Plane3;}
interface Interval {lo:AlgebraicReal;hi:AlgebraicReal;sample:AlgebraicReal;node:number;}
const owned=new WeakMap<PreparedTrimmedPlanar3,{base:PreparedPlanarFace3;halfspaces:readonly PlanarHalfSpace3[]}>();
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {
  let A=a,B=b;while(A.upper.compare(B.lower)>=0){if(A.upper.sub(A.lower).compare(B.upper.sub(B.lower))>=0)A=A.refine();else B=B.refine();}return A.upper.add(B.lower).div(two);
}
function sameCurve(a:Curve3,b:Curve3):1|-1|0 {
  const A=curveEndpoints3(a),B=curveEndpoints3(b),direction=samePoint(A[0],B[0])&&samePoint(A[1],B[1])?1:samePoint(A[0],B[1])&&samePoint(A[1],B[0])?-1:0;
  if(!direction)return 0;if(a.kind==='algebraic-segment'&&b.kind==='algebraic-segment')return direction;
  return a.kind===b.kind&&pointOnCurve3(witness(a),b)&&pointOnCurve3(witness(b),a)?direction:0;
}
/** Reusable regularized rational-halfspace trim of a factory-owned planar face.
 * Vertical cells handle holes, concavity, ellipses and algebraic rectangle bounds.
 */
export function prepareTrimmedPlanar3(input:PreparedPlanarFace3,halfspaces:readonly PlanarHalfSpace3[]=[]):PreparedTrimmedPlanar3 {
  const base=translatePlanarFace3(input,vector3(0n,0n,0n)),g=chartGeometry(base),frame=g.frame,[DU,DV]=duals(frame),S=dot3(base.normal,cross3(frame.u,frame.v)).sign(),records=new Map<string,LocalPlane>();let impossible=false;
  for(const h of halfspaces){
    if(h.side!==-1&&h.side!==1)throw new RangeError('Halfspace side must be -1 or +1');const p=plane3(h.plane.normal.x,h.plane.normal.y,h.plane.normal.z,h.plane.offset),scale=new Rational(h.side===-1?1n:-1n);let a=dot3(p.normal,frame.u).mul(scale),b=dot3(p.normal,frame.v).mul(scale),c=dot3(p.normal,frame.origin).add(p.offset).mul(scale);
    if(a.sign()===0&&b.sign()===0){if(c.sign()>0)impossible=true;continue;}
    const pivot=a.sign()!==0?a:b,factor=one.div(pivot.sign()<0?pivot.neg():pivot);a=a.mul(factor);b=b.mul(factor);c=c.mul(factor);
    const n=vector3(DU.x.mul(a).add(DV.x.mul(b)),DU.y.mul(a).add(DV.y.mul(b)),DU.z.mul(a).add(DV.z.mul(b))),plane=plane3(n.x,n.y,n.z,c.sub(dot3(n,frame.origin)));records.set([a,b,c].map(x=>x.toString()).join(','),{a,b,c,plane});
  }
  const cuts=[...records.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,p])=>p),signAt=(p:LocalPlane,x:AlgebraicReal,y:AlgebraicReal)=>p.b.sign()===0?x.affine(p.a,p.c).sign():p.b.sign()*y.compare(x.affine(p.a.neg().div(p.b),p.c.neg().div(p.b)));
  for(const p of cuts)if(records.has([p.a.neg(),p.b.neg(),p.c.neg()].map(x=>x.toString()).join(',')))impossible=true;
  const publicHalfspaces=Object.freeze([...cuts.map(p=>Object.freeze({plane:p.plane,side:-1 as const})),...(impossible?[Object.freeze({plane:plane3(base.surface.normal.x,base.surface.normal.y,base.surface.normal.z,base.surface.offset.add(one)),side:-1 as const})]:[])]);
  const baseInside=(x:AlgebraicReal,y:AlgebraicReal):boolean=>{
    if(g.critical.some(a=>a.compare(x)===0))return base.locate(map(frame,x,y))==='inside';
    const events=uniqueReals(g.curves.flatMap(c=>g.slice(c,x)));return !events.some(a=>a.compare(y)===0)&&events.filter(a=>a.compare(y)<0).length%2===1;
  };
  const strict=(x:AlgebraicReal,y:AlgebraicReal)=>!impossible&&cuts.every(p=>signAt(p,x,y)<0)&&baseInside(x,y);
  const axisHits=(curve:Curve3,p:LocalPlane):readonly AlgebraicCoordinates3[]|null=>{
    if(curve.kind!=='algebraic-segment')return null;const A=pointInPlaneFrame3(frame,curve.segment.start)!,B=pointInPlaneFrame3(frame,curve.segment.end)!;
    if(A.x.compare(B.x)===0){
      if(p.b.sign()===0)return A.x.affine(p.a,p.c).sign()===0?[curve.segment.start,curve.segment.end]:[];
      const rate=p.a.neg().div(p.b),offset=p.c.neg().div(p.b),y=A.x.affine(rate,offset),lo=A.y.compare(B.y)<0?A.y:B.y,hi=A.y.compare(B.y)>0?A.y:B.y;
      return y.compare(lo)>=0&&y.compare(hi)<=0?[mapPlanePoint3(frame,algebraicPoint2(point2(0n,offset),point2(1n,rate),A.x))]:[];
    }
    if(A.y.compare(B.y)===0){
      if(p.a.sign()===0)return A.y.affine(p.b,p.c).sign()===0?[curve.segment.start,curve.segment.end]:[];
      const rate=p.b.neg().div(p.a),offset=p.c.neg().div(p.a),x=A.y.affine(rate,offset),lo=A.x.compare(B.x)<0?A.x:B.x,hi=A.x.compare(B.x)>0?A.x:B.x;
      return x.compare(lo)>=0&&x.compare(hi)<=0?[mapPlanePoint3(frame,algebraicPoint2(point2(offset,0n),point2(rate,1n),A.y))]:[];
    }
    return null;
  };
  const splitOriginal=(curve:Curve3,p:LocalPlane):readonly Curve3[]=>{
    const hits=axisHits(curve,p);if(hits===null)return splitBoundary(curve,p.plane);if(curve.kind!=='algebraic-segment')throw new Error('Expected segment');
    const s=curve.segment,points=[s.start,...hits.filter(q=>!samePoint(q,s.start)&&!samePoint(q,s.end)),s.end],A=pointInPlaneFrame3(frame,s.start)!,B=pointInPlaneFrame3(frame,s.end)!,axis=A.x.compare(B.x)!==0?'x':'y',direction=A[axis].compare(B[axis])<0?1:-1;
    points.sort((a,b)=>pointInPlaneFrame3(frame,a)![axis].compare(pointInPlaneFrame3(frame,b)![axis])*direction);
    return points.slice(0,-1).map((point,i)=>snapshotCurve3({kind:'algebraic-segment',segment:algebraicSegment3(point,points[i+1]!)}));
  };
  const critical=[...g.critical,real(g.xMin),real(g.xMax)],candidateLines:{plane:LocalPlane;curve:Curve3}[]=[];
  for(const p of cuts){
    if(p.b.sign()===0)critical.push(real(p.c.neg().div(p.a)));
    const x1=p.b.sign()!==0?g.xMin:p.c.neg().div(p.a),x2=p.b.sign()!==0?g.xMax:x1,y1=p.b.sign()!==0?p.a.mul(x1).add(p.c).neg().div(p.b):g.yMin,y2=p.b.sign()!==0?p.a.mul(x2).add(p.c).neg().div(p.b):g.yMax;
    let start=mapQ(frame,x1,y1),end=mapQ(frame,x2,y2);const forward=p.b.sign()!==0?-S*p.b.sign():S*p.a.sign();if(forward<0)[start,end]=[end,start];const segment=algebraicSegment3(start,end),points:AlgebraicCoordinates3[]=[segment.start,segment.end];
    for(const boundary of g.curves){
      let hits:readonly AlgebraicCoordinates3[]=[];
      if(boundary.kind==='elliptic-arc')hits=intersectAlgebraicSegmentEllipse3(segment,boundary.arc.ellipse).filter(q=>pointOnCurve3(q,boundary));
      else if(boundary.kind==='algebraic-segment')hits=axisHits(boundary,p)??segmentCross(segment,boundary.segment);
      points.push(...hits);for(const q of hits)critical.push(pointInPlaneFrame3(frame,q)!.x);
    }
    for(const other of cuts){const hit=intersectAlgebraicSegmentPlane3(segment,other.plane);if(hit.kind==='point'){points.push(hit.point);critical.push(pointInPlaneFrame3(frame,hit.point)!.x);}}
    const unique=points.filter((q,i,all)=>all.findIndex(r=>samePoint(q,r))===i),axis=p.b.sign()!==0?'x':'y',sign=forward;
    unique.sort((a,b)=>pointInPlaneFrame3(frame,a)![axis].compare(pointInPlaneFrame3(frame,b)![axis])*sign);
    for(let i=0;i+1<unique.length;i++){const curve=snapshotCurve3({kind:'algebraic-segment',segment:algebraicSegment3(unique[i]!,unique[i+1]!)});if(base.locate(witness(curve))==='inside')candidateLines.push({plane:p,curve});}
  }
  const X=uniqueReals(critical).filter(x=>x.compare(real(g.xMin))>=0&&x.compare(real(g.xMax))<=0);
  const fibers=(x:AlgebraicReal,column:boolean):Interval[]=>{
    if(impossible)return [];if(cuts.some(p=>p.b.sign()===0&&x.affine(p.a,p.c).sign()>=0))return [];
    const baseY=uniqueReals(g.curves.flatMap(c=>g.slice(c,x))),values=[real(g.yMin),real(g.yMax),...baseY];
    for(const p of cuts)if(p.b.sign()!==0)values.push(x.affine(p.a.neg().div(p.b),p.c.neg().div(p.b)));
    const Y=uniqueReals(values).filter(y=>y.compare(real(g.yMin))>=0&&y.compare(real(g.yMax))<=0),result:Interval[]=[];
    for(let i=0;i+1<Y.length;i++){
      const lo=Y[i]!,hi=Y[i+1]!,sample=lo.add(hi).affine('1/2');if(cuts.some(p=>signAt(p,x,sample)>=0))continue;
      const inside=column?baseInside(x,sample):baseY.filter(y=>y.compare(sample)<0).length%2===1;
      if(inside)result.push({lo,hi,sample,node:-1});
    }
    return result;
  };
  const slabs=Array.from({length:Math.max(0,X.length-1)},(_,i)=>{const probe=between(X[i]!,X[i+1]!);return {probe,cells:fibers(real(probe),false)};}),parents:number[]=[],nodeSamples:AlgebraicCoordinates3[]=[];
  for(const slab of slabs)for(const cell of slab.cells){cell.node=parents.length;parents.push(cell.node);nodeSamples.push(map(frame,real(slab.probe),cell.sample));}
  const find=(i:number):number=>parents[i]===i?i:(parents[i]=find(parents[i]!));
  const rayBarriers=(fixed:AlgebraicReal,axis:'x'|'y'):AlgebraicReal[]=>{
    const values=g.curves.flatMap(c=>g.slice(c,fixed,axis));
    for(const p of cuts){const coefficient=axis==='x'?p.b:p.a,other=axis==='x'?p.a:p.b;if(coefficient.sign()!==0)values.push(fixed.affine(other.neg().div(coefficient),p.c.neg().div(coefficient)));}
    return uniqueReals(values);
  };
  const probeNode=(at:number,side:-1|1,y:AlgebraicReal):number=>{
    const slabIndex=side===-1?at-1:at,slab=slabs[slabIndex]!,x=X[at]!,barriers=rayBarriers(y,'y');
    barriers.push(X[slabIndex]!,X[slabIndex+1]!);const candidates=uniqueReals(barriers).filter(b=>b.compare(x)===side),barrier=side===-1?candidates[candidates.length-1]!:candidates[0]!,q=side===-1?between(barrier,x):between(x,barrier);
    if(!strict(real(q),y))throw new Error('A planar adjacency probe crossed an unenumerated boundary');
    const local=fibers(real(q),false),index=local.findIndex(c=>c.lo.compare(y)<0&&c.hi.compare(y)>0);
    if(index<0||local.length!==slab.cells.length)throw new Error('Planar vertical cell order changed without a critical coordinate');return slab.cells[index]!.node;
  };
  const columns=X.map((x,i)=>fibers(x,true).map(cell=>{
    const nodes:number[]=[];if(i>0)nodes.push(probeNode(i,-1,cell.sample));if(i<slabs.length)nodes.push(probeNode(i,1,cell.sample));if(!nodes.length)throw new Error('Interior vertical column has no adjacent slab');
    for(const node of nodes.slice(1))parents[find(node)]=find(nodes[0]!);return {...cell,node:nodes[0]!};
  }));
  const roots=[...new Set(parents.map((_,i)=>find(i)))],rootIndex=new Map(roots.map((r,i)=>[r,i]));
  const label=(x:AlgebraicReal,y:AlgebraicReal):number=>{
    const column=X.findIndex(a=>a.compare(x)===0);let node:number|undefined;
    if(column>=0)node=columns[column]!.find(c=>c.lo.compare(y)<0&&c.hi.compare(y)>0)?.node;
    else {const slab=slabs.findIndex((_,i)=>x.compare(X[i]!)>0&&x.compare(X[i+1]!)<0);if(slab>=0){const row=fibers(x,false).findIndex(c=>c.lo.compare(y)<0&&c.hi.compare(y)>0);if(row>=0)node=slabs[slab]!.cells[row]?.node;}}
    if(node===undefined)throw new Error('Strict planar point is missing from its vertical cell');return rootIndex.get(find(node))!;
  };
  const candidates:Curve3[]=[];
  if(roots.length){
    for(const original of g.curves)for(const part of verticalPieces(original,g)){let pieces:readonly Curve3[]=[part];for(const p of cuts)pieces=pieces.flatMap(c=>splitOriginal(c,p));candidates.push(...pieces);}
    candidates.push(...candidateLines.map(c=>c.curve));
  }
  const edges:Curve3[]=[],edgeLabels:number[]=[];
  for(const c of candidates){
    const point=witness(c),q=pointInPlaneFrame3(frame,point)!,t=g.tangent(c,point);let keep=true;
    for(const p of cuts){const sign=signAt(p,q.x,q.y);if(sign>0){keep=false;break;}if(sign===0){if(!curveOnSurface3(c,{kind:'plane',plane:p.plane}))throw new Error('Planar boundary was not completely noded');if(t.x.affine(p.b).sub(t.y.affine(p.a)).sign()*S>=0){keep=false;break;}}}
    if(!keep||edges.some(e=>sameCurve(c,e)!==0))continue;
    const dx=t.x.sign()!==0?0:-t.y.sign()*S,dy=t.x.sign()!==0?t.x.sign()*S:0;if(dx===0&&dy===0)throw new Error('Planar boundary tangent is zero');
    const axis=dx===0?'x':'y',direction=dx===0?dy:dx,position=dx===0?q.y:q.x,barriers=rayBarriers(dx===0?q.x:q.y,axis);
    barriers.push(real(dx===0?g.yMin:g.xMin),real(dx===0?g.yMax:g.xMax));const choices=uniqueReals(barriers).filter(b=>b.compare(position)===direction),next=direction<0?choices[choices.length-1]!:choices[0]!;
    if(next===undefined)throw new Error('Boundary inward ray has no bounding event');const coordinate=position.add(next).affine('1/2'),x=dx===0?q.x:coordinate,y=dx===0?coordinate:q.y;
    if(!strict(x,y))throw new Error('Planar inward witness is not in adjacent material');const owner=label(x,y);
    edges.push(snapshotCurve3(c));edgeLabels.push(owner);
  }
  const table=Object.freeze(edges),empty=roots.length===0;
  const locate:PreparedTrimmedPlanar3['locate']=inputPoint=>{
    const p=snapshotExactPoint3(inputPoint),position=base.locate(p);if(empty||position==='outside')return 'outside';const q=pointInPlaneFrame3(frame,p)!;let onCut=false;
    for(const cut of cuts){const sign=signAt(cut,q.x,q.y);if(sign>0)return 'outside';if(sign===0)onCut=true;}return onCut?table.some(c=>pointOnCurve3(p,c))?'boundary':'outside':position;
  };
  const components=Object.freeze(roots.map((root,index)=>{
    const uses=Object.freeze(table.flatMap((_,edge)=>edgeLabels[edge]===index?[Object.freeze({edge,direction:1 as const})]:[]));if(!uses.length)throw new Error('A planar component has no boundary');const sample=nodeSamples[parents.findIndex((_,i)=>find(i)===root)]!;
    const component:TrimmedPlanarComponent3=Object.freeze({sample,uses,loops:traceLoops(table,uses),locate:(inputPoint:Point3|AlgebraicCoordinates3)=>{const p=snapshotExactPoint3(inputPoint),position=locate(p);if(position==='outside')return position;if(position==='boundary')return uses.some(u=>pointOnCurve3(p,table[u.edge]!))?'boundary':'outside';const q=pointInPlaneFrame3(frame,p)!;return label(q.x,q.y)===index?'inside':'outside';}});
    if(component.locate(sample)!=='inside')throw new Error('Planar component sample is not interior');return component;
  }));
  const result=Object.freeze({base,frame,halfspaces:publicHalfspaces,empty,edges:table,components,locate});
  owned.set(result,{base,halfspaces:publicHalfspaces});return result;
}
/** Coplanar cuts are explicit; they do not duplicate a face into two children. */
export function splitTrimmedPlanarByPlane3(input:PreparedTrimmedPlanar3,inputPlane:Plane3):TrimmedPlanarSplit3 {
  const data=owned.get(input);if(!data)throw new RangeError('Planar splitting requires a factory-created trimmed domain');const p=plane3(inputPlane.normal.x,inputPlane.normal.y,inputPlane.normal.z,inputPlane.offset),a=dot3(p.normal,input.frame.u),b=dot3(p.normal,input.frame.v),c=dot3(p.normal,input.frame.origin).add(p.offset);
  if(a.sign()===0&&b.sign()===0&&c.sign()===0)return Object.freeze({kind:'coplanar',region:input});
  const negative=prepareTrimmedPlanar3(data.base,[...data.halfspaces,{plane:p,side:-1}]),positive=prepareTrimmedPlanar3(data.base,[...data.halfspaces,{plane:p,side:1}]),edges:Curve3[]=[],uses:{negative:BRepEdgeUse3[];positive:BRepEdgeUse3[]}={negative:[],positive:[]};
  for(const [name,region] of [['negative',negative],['positive',positive]] as const)region.edges.forEach(curve=>{let edge=edges.findIndex(c=>sameCurve(curve,c)!==0),direction:1|-1=1;if(edge<0){edge=edges.length;edges.push(curve);}else direction=sameCurve(curve,edges[edge]!) as 1|-1;uses[name].push(Object.freeze({edge,direction}));});
  const shared=uses.negative.filter(u=>uses.positive.some(v=>u.edge===v.edge)).map(u=>u.edge);
  for(const edge of shared)if(uses.negative.find(u=>u.edge===edge)!.direction===uses.positive.find(u=>u.edge===edge)!.direction)throw new Error('Planar shared edge has equal boundary directions');
  const faces:{surface:{kind:'plane';plane:Plane3};sense:1|-1;loops:readonly (readonly BRepEdgeUse3[])[]}[]=[],ids:{negative:number[];positive:number[]}={negative:[],positive:[]};let topology:BRepTopology3|null=null;
  if([...negative.components,...positive.components].every(c=>c.loops!==null)){
    for(const [name,region] of [['negative',negative],['positive',positive]] as const)for(const component of region.components){ids[name].push(faces.length);faces.push({surface:{kind:'plane',plane:data.base.surface},sense:data.base.sense,loops:component.loops!.map(loop=>loop.map(u=>uses[name][u.edge]!))});}topology=buildBRepTopology3(edges,faces);
  }
  return Object.freeze({kind:'split',negative,positive,edges:Object.freeze(edges),negativeUses:Object.freeze(uses.negative),positiveUses:Object.freeze(uses.positive),sharedEdges:Object.freeze(shared),topology,topologyFaces:Object.freeze({negative:Object.freeze(ids.negative),positive:Object.freeze(ids.positive)})});
}
