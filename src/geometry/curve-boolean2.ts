import {segment2} from './point2.js';
import type {Point2} from './point2.js';
import {compareAlgebraicPoints2,snapshotExactPoint2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import {circularArc2,reverseCircularArc2} from './circular-arc2.js';
import {lineInterval2} from './line-interval2.js';
import {buildCurveFaces2} from './curve-faces2.js';
import type {CurveFaceArrangement2} from './curve-faces2.js';
import type {PlanarCurve2} from './split-curves2.js';
import type {BooleanOperation,FillRule} from './polygon-boolean.js';

/** An oriented, bounded boundary primitive. Point primitives have no winding. */
export type CurveBoundary2=Exclude<PlanarCurve2,{readonly kind:'point'}>;
/** Explicitly connected closed walks; full circles may form a one-primitive ring.
 * Walks may self-intersect or touch. Traversal affects the nonzero fill rule.
 */
export type CurveRegion2=readonly (readonly CurveBoundary2[])[];
export type CurveRegionLocation2='outside'|'inside'|'boundary';
export interface CurveBooleanResult2 {
  /** Regularized boundary walks, selected material on the left. Reusable as input. */
  readonly rings:CurveRegion2;
  readonly arrangement:CurveFaceArrangement2;
  readonly selectedFaces:readonly number[];
  /** Exact integer winding for each input region at every open face. */
  readonly windings:readonly (readonly [bigint,bigint])[];
  /** Location in the regularized result, ignoring canceled/internal input curves. */
  locate(point:Point2|AlgebraicCoordinates2):CurveRegionLocation2;
}
function snapshot(curve:CurveBoundary2):CurveBoundary2 {
  switch(curve.kind){
    case 'segment':return Object.freeze({kind:'segment',segment:segment2(curve.segment.start,curve.segment.end)});
    case 'line':return Object.freeze({kind:'line',interval:lineInterval2(curve.interval.line,curve.interval.startParameter,curve.interval.endParameter)});
    case 'arc':return Object.freeze({kind:'arc',arc:circularArc2(curve.arc.circle,curve.arc.start,curve.arc.end,{direction:curve.arc.direction,fullCircle:curve.arc.fullCircle})});
    default:throw new RangeError('Unknown curve boundary kind');
  }
}
function endpoints(curve:CurveBoundary2):readonly [AlgebraicCoordinates2,AlgebraicCoordinates2] {
  const data=curve.kind==='segment'?curve.segment:curve.kind==='line'?curve.interval:curve.arc;
  return [snapshotExactPoint2(data.start),snapshotExactPoint2(data.end)];
}
/** Regularized area Boolean on rational line/circle supports with algebraic trims.
 * Edge/point-only intersections disappear. Curved areas are not approximated.
 */
export function booleanCurveRegions2(a:CurveRegion2,b:CurveRegion2,operation:BooleanOperation,fillRule:FillRule='even-odd'):CurveBooleanResult2 {
  if(!['union','intersection','difference','xor'].includes(operation))throw new RangeError('Unknown Boolean operation');
  if(fillRule!=='even-odd'&&fillRule!=='nonzero')throw new RangeError('Unknown fill rule');
  const curves:CurveBoundary2[]=[],owners:(0|1)[]=[];
  [a,b].forEach((region,owner)=>{
    for(const input of region){
      if(!input.length)throw new RangeError('A curve ring must contain a closed walk');
      const ring=input.map(snapshot),ends=ring.map(endpoints);
      for(let i=0;i<ring.length;i++){
        if(compareAlgebraicPoints2(ends[i]![1],ends[(i+1)%ring.length]![0])!==0)throw new RangeError('Curve ring is not a connected closed walk');
        curves.push(ring[i]!);owners.push(owner as 0|1);
      }
    }
  });
  const arrangement=buildCurveFaces2(curves);
  type Winding=readonly [bigint,bigint];
  const adjacency:{face:number;delta:Winding}[][]=arrangement.faces.map(()=>[]);
  arrangement.edges.forEach((edge,i)=>{
    const delta:[bigint,bigint]=[0n,0n];
    for(const use of edge.uses)delta[owners[use.source]!]+=BigInt(use.direction);
    const left=arrangement.halfEdgeFaces[2*i]!,right=arrangement.halfEdgeFaces[2*i+1]!;
    adjacency[right]!.push({face:left,delta});adjacency[left]!.push({face:right,delta:[-delta[0],-delta[1]]});
  });
  const winding:(Winding|undefined)[]=arrangement.faces.map(()=>undefined);winding[0]=[0n,0n];
  const queue=[0];
  for(let i=0;i<queue.length;i++){
    const face=queue[i]!,value=winding[face]!;
    for(const link of adjacency[face]!){
      const next:Winding=[value[0]+link.delta[0],value[1]+link.delta[1]],prior=winding[link.face];
      if(prior===undefined){winding[link.face]=next;queue.push(link.face);}
      else if(prior[0]!==next[0]||prior[1]!==next[1])throw new Error('Inconsistent curved face winding propagation');
    }
  }
  const inside=(n:bigint)=>fillRule==='nonzero'?n!==0n:n%2n!==0n;
  const windings=Object.freeze(winding.map(w=>{if(!w)throw new Error('Disconnected curved face adjacency');return Object.freeze(w);}));
  const selected=windings.map(w=>{
    const x=inside(w[0]),y=inside(w[1]);
    switch(operation){case 'union':return x||y;case 'intersection':return x&&y;case 'difference':return x&&!y;case 'xor':return x!==y;}
  });
  const boundary=new Set<number>();
  arrangement.halfEdges.forEach((h,id)=>{if(selected[arrangement.halfEdgeFaces[id]!]&&!selected[arrangement.halfEdgeFaces[h.twin]!])boundary.add(id);});
  const positions:number[]=[];arrangement.outgoing.forEach(ids=>ids.forEach((id,i)=>{positions[id]=i;}));
  const next=new Map<number,number>(),incoming=new Set<number>();
  for(const id of boundary){
    const h=arrangement.halfEdges[id]!,around=arrangement.outgoing[h.target]!;
    for(let offset=1;offset<=around.length;offset++){
      const candidate=around[(positions[h.twin]!+around.length-offset)%around.length]!;
      if(boundary.has(candidate)){next.set(id,candidate);if(incoming.has(candidate))throw new Error('Curved Boolean boundary successor is not bijective');incoming.add(candidate);break;}
    }
    if(!next.has(id))throw new Error('Open curved Boolean boundary');
  }
  const visited=new Set<number>(),rings:(readonly CurveBoundary2[])[]=[];
  for(const start of boundary){
    if(visited.has(start))continue;
    const ring:CurveBoundary2[]=[];let id=start;
    do {
      if(visited.has(id))throw new Error('Non-cyclic curved Boolean boundary');visited.add(id);
      const h=arrangement.halfEdges[id]!,edge=arrangement.edges[h.edge]!,forward=h.origin===edge.start;
      if(edge.kind==='arc')ring.push(Object.freeze({kind:'arc',arc:forward?edge.arc:reverseCircularArc2(edge.arc)}));
      else ring.push(Object.freeze({kind:'line',interval:forward?edge.interval:lineInterval2(edge.interval.line,edge.interval.endParameter,edge.interval.startParameter)}));
      id=next.get(id)!;
    }while(id!==start);
    rings.push(Object.freeze(ring));
  }
  const locate=(point:Point2|AlgebraicCoordinates2):CurveRegionLocation2=>{
    const hit=arrangement.locate(point);
    const faces=hit.kind==='face'?[hit.face]:hit.kind==='vertex'?arrangement.vertexFaces[hit.vertex]!: [arrangement.halfEdgeFaces[2*hit.edge]!,arrangement.halfEdgeFaces[2*hit.edge+1]!];
    const any=faces.some(f=>selected[f]),all=faces.every(f=>selected[f]);
    return all?'inside':any?'boundary':'outside';
  };
  return Object.freeze({rings:Object.freeze(rings),arrangement,selectedFaces:Object.freeze(selected.flatMap((yes,i)=>yes?[i]:[])),windings,locate});
}
