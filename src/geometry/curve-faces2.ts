import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point2} from './point2.js';
import type {Point2} from './point2.js';
import {algebraicCoordinates2,compareAlgebraicPoints2,snapshotExactPoint2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import {buildCurveHalfEdges2} from './curve-half-edges2.js';
import type {CurveHalfEdgeArrangement2} from './curve-half-edges2.js';
import type {PlanarCurve2,CurveEdge2} from './split-curves2.js';

export interface CurveFace2 {
  readonly bounded:boolean;
  readonly boundaries:readonly number[];
  readonly isolatedVertices:readonly number[];
  /** Exact rational witness in the open face, never on the graph. */
  readonly sample:Point2;
}
export type CurveFaceLocation2=
 | {readonly kind:'face';readonly face:number}
 | {readonly kind:'edge';readonly edge:number}
 | {readonly kind:'vertex';readonly vertex:number};
export interface CurveFaceArrangement2 extends CurveHalfEdgeArrangement2 {
  readonly faces:readonly CurveFace2[];
  readonly boundaryFaces:readonly number[];
  readonly halfEdgeFaces:readonly number[];
  readonly vertexFaces:readonly (readonly number[])[];
  locate(point:Point2|AlgebraicCoordinates2):CurveFaceLocation2;
}
const real=(q:Rational)=>AlgebraicReal.fromRational(q),one=new Rational(1n),two=new Rational(2n);
function rationalBetween(lower:AlgebraicReal,upper:AlgebraicReal):Rational {
  if(lower.compare(upper)>=0)throw new Error('Expected a nonempty algebraic interval');
  let a=lower,b=upper;
  while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}
  return a.upper.add(b.lower).div(two);
}
/** Groups curved boundary orbits into open faces without approximating curved area.
 * Generic rational vertical slabs establish visibility; degenerate vertical-only
 * components and isolated vertices are attached by exact vertical ray location.
 */
export function buildCurveFaces2(input:readonly PlanarCurve2[]):CurveFaceArrangement2 {
  const a=buildCurveHalfEdges2(input),parent=Array.from({length:a.boundaries.length+1},(_,i)=>i);
  const find=(id:number):number=>{let root=id;while(parent[root]!==root)root=parent[root]!;while(parent[id]!==id){const next=parent[id]!;parent[id]=root;id=next;}return root;};
  const unite=(x:number,y:number)=>{x=find(x);y=find(y);if(x!==y)parent[Math.max(x,y)]=Math.min(x,y);};
  const boundary=(edge:number,above:boolean)=>a.halfEdges[2*edge+(above?0:1)]!.boundary+1;
  const vertexId=(point:AlgebraicCoordinates2):number|null=>{
    let lo=0,hi=a.vertices.length;
    while(lo<hi){const mid=Math.floor((lo+hi)/2),comparison=compareAlgebraicPoints2(a.vertices[mid]!.point,point);if(comparison<0)lo=mid+1;else hi=mid;}
    return lo<a.vertices.length&&compareAlgebraicPoints2(a.vertices[lo]!.point,point)===0?lo:null;
  };
  const isVertical=(edge:CurveEdge2)=>edge.kind==='line'&&edge.interval.line.direction.x.sign()===0;
  type Hit={y:AlgebraicReal;edge:number};
  type Vertical={edge:number;lower:AlgebraicReal;upper:AlgebraicReal};
  function fiber(x:AlgebraicReal):{hits:Hit[];verticals:Vertical[]}{
    const hits:Hit[]=[],verticals:Vertical[]=[],radicals=new Map<string,AlgebraicReal>();
    a.edges.forEach((edge,index)=>{
      const start=a.vertices[edge.start]!.point,end=a.vertices[edge.end]!.point;
      if(x.compare(start.x)<0||x.compare(end.x)>0)return;
      if(isVertical(edge)){
        verticals.push({edge:index,lower:start.y,upper:end.y});hits.push({y:start.y,edge:index},{y:end.y,edge:index});return;
      }
      if(start.x.compare(end.x)>=0)throw new Error('Nonvertical curve edge is not strictly x-monotone');
      let y:AlgebraicReal;
      if(edge.kind==='line')y=x.affine(edge.interval.line.direction.y,edge.interval.line.origin.y);
      else {
        const c=edge.arc.circle,key=`${c.center.x},${c.center.y},${c.radiusSquared}`;
        let root=radicals.get(key);
        if(!root){const dx=x.affine(1n,c.center.x.neg()),radicand=dx.mul(dx).affine(-1n,c.radiusSquared);if(radicand.sign()<0)throw new Error('Circle fiber lies outside a valid arc span');root=radicand.sqrt();radicals.set(key,root);}
        // Canonical x-increasing upper arcs are CW; lower arcs are CCW.
        y=root.affine(edge.arc.direction==='cw'?1n:-1n,c.center.y);
      }
      hits.push({y,edge:index});
    });
    hits.sort((u,v)=>u.y.compare(v.y));return {hits,verticals};
  }
  // At a vertex, the face below is the left sector of the clockwise predecessor
  // of a synthetic downward straight germ (curvature zero).
  function belowVertex(vertex:number):number {
    const ids=a.outgoing[vertex]!;
    if(!ids.length)throw new Error('An isolated point cannot be an edge-ray hit');
    let before:number|undefined;
    for(const id of ids){
      const g=a.halfEdges[id]!.germ,x=g.tangent.x.sign(),y=g.tangent.y.sign(),half=y<0||y===0&&x<0?1:0;
      const comparison=half===0?-1:x!==0?x:g.curvatureSign;
      if(comparison===0)throw new Error('Face ray overlaps a downward edge');
      if(comparison<0)before=id;
    }
    return a.halfEdges[before??ids[ids.length-1]!]!.boundary+1;
  }
  function faceAbove(point:AlgebraicCoordinates2,data=fiber(point.x)):number {
    const hit=data.hits.find(h=>h.y.compare(point.y)>0);
    if(!hit)return 0;
    const vertex=vertexId(algebraicCoordinates2(point.x,hit.y));
    return vertex!==null?belowVertex(vertex):boundary(hit.edge,false);
  }
  const components:number[][]=[],visited=new Set<number>();
  a.vertices.forEach((_,start)=>{
    if(visited.has(start))return;
    const component:number[]=[],pending=[start];visited.add(start);
    while(pending.length){const v=pending.pop()!;component.push(v);for(const id of a.outgoing[v]!){const target=a.halfEdges[id]!.target;if(!visited.has(target)){visited.add(target);pending.push(target);}}}
    components.push(component);
  });
  const xs=a.vertices.map(v=>v.point.x).sort((x,y)=>x.compare(y)).filter((x,i,array)=>i===0||x.compare(array[i-1]!)!==0);
  const seenBoundary=new Set<number>(),samples:{node:number;point:Point2}[]=[];
  for(let i=1;i<xs.length;i++){
    const x=rationalBetween(xs[i-1]!,xs[i]!),data=fiber(real(x));
    if(data.verticals.length)throw new Error('Generic slab contains a vertical edge');
    const hits=data.hits;
    if(!hits.length)continue;
    unite(0,boundary(hits[0]!.edge,false));unite(0,boundary(hits[hits.length-1]!.edge,true));
    hits.forEach(h=>{seenBoundary.add(a.halfEdges[2*h.edge]!.boundary);seenBoundary.add(a.halfEdges[2*h.edge+1]!.boundary);});
    for(let j=1;j<hits.length;j++){
      const lower=hits[j-1]!,upper=hits[j]!;
      if(lower.y.compare(upper.y)>=0)throw new Error('Generic slab contains an un-noded crossing');
      const node=boundary(lower.edge,true);unite(node,boundary(upper.edge,false));
      samples.push({node,point:point2(x,rationalBetween(lower.y,upper.y))});
    }
  }
  for(const component of components){
    const edgeIds=[...new Set(component.flatMap(v=>a.outgoing[v]!.map(id=>a.halfEdges[id]!.edge)))];
    if(!edgeIds.length)continue;
    const boundaries=new Set(component.flatMap(v=>a.outgoing[v]!.map(id=>a.halfEdges[id]!.boundary)));
    if(edgeIds.some(id=>!isVertical(a.edges[id]!))){
      if([...boundaries].some(b=>!seenBoundary.has(b)))throw new Error('Nonvertical boundary has no slab visibility');
      continue;
    }
    if(boundaries.size!==1)throw new Error('A vertical-only component must have one boundary orbit');
    const top=component.reduce((best,v)=>a.vertices[v]!.point.y.compare(a.vertices[best]!.point.y)>0?v:best,component[0]!);
    const edge=a.edges[edgeIds[0]!]!;if(edge.kind!=='line')throw new Error('Vertical arc edge is invalid');
    const point=algebraicCoordinates2(edge.interval.line.origin.x,a.vertices[top]!.point.y);
    unite([...boundaries][0]!+1,faceAbove(point));
  }
  const roots=[...new Set(parent.map((_,i)=>find(i)))].sort((x,y)=>x-y),faceIds=new Map(roots.map((root,i)=>[root,i]));
  const expected=a.edges.length-a.vertices.length+1+components.length;
  if(roots.length!==expected)throw new Error('Curved face grouping failed planar Euler completeness');
  const boundaryFaces=Object.freeze(a.boundaries.map((_,i)=>faceIds.get(find(i+1))!));
  const halfEdgeFaces=Object.freeze(a.halfEdges.map(h=>boundaryFaces[h.boundary]!));
  const outside=point2(xs.length?xs[0]!.lower.sub(one):0n,0n);
  const faces:{bounded:boolean;boundaries:number[];isolatedVertices:number[];sample:Point2}[]=roots.map((root,id)=>{
    const witness=id===0?outside:samples.find(s=>find(s.node)===root)?.point;
    if(!witness)throw new Error('Bounded curve face has no rational witness');
    return {bounded:id!==0,boundaries:[],isolatedVertices:[],sample:witness};
  });
  boundaryFaces.forEach((face,b)=>faces[face]!.boundaries.push(b));
  const vertexFaces=Object.freeze(a.vertices.map((v,index)=>{
    if(a.outgoing[index]!.length)return Object.freeze([...new Set(a.outgoing[index]!.map(id=>halfEdgeFaces[id]!))].sort((x,y)=>x-y));
    const face=faceIds.get(find(faceAbove(v.point)))!;faces[face]!.isolatedVertices.push(index);return Object.freeze([face]);
  }));
  const locate=(inputPoint:Point2|AlgebraicCoordinates2):CurveFaceLocation2=>{
    const point=snapshotExactPoint2(inputPoint),vertex=vertexId(point);
    if(vertex!==null)return Object.freeze({kind:'vertex',vertex});
    const data=fiber(point.x);
    const vertical=data.verticals.find(v=>point.y.compare(v.lower)>=0&&point.y.compare(v.upper)<=0);
    if(vertical)return Object.freeze({kind:'edge',edge:vertical.edge});
    const hit=data.hits.find(h=>h.y.compare(point.y)===0);
    if(hit)return Object.freeze({kind:'edge',edge:hit.edge});
    return Object.freeze({kind:'face',face:faceIds.get(find(faceAbove(point,data)))!});
  };
  return Object.freeze({...a,faces:Object.freeze(faces.map(f=>Object.freeze({...f,boundaries:Object.freeze(f.boundaries),isolatedVertices:Object.freeze(f.isolatedVertices)}))),boundaryFaces,halfEdgeFaces,vertexFaces,locate});
}
