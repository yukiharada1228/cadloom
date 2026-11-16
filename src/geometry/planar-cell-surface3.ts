import {certifyAlgebraicAxialPair3,commonAlgebraicAxialLine3} from './algebraic-axial-point3.js';
import {Rational} from '../numeric/rational.js';
import type {Sign} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {plane3,intersectPlanes3} from './plane3.js';
import {cylinder3,classifyPointToSurface3} from './surface3.js';
import type {Surface3} from './surface3.js';
import {point3,dot3} from './point3.js';
import {algebraicLine3,algebraicLinePoint3} from './algebraic-line3.js';
import type {AlgebraicLine3} from './algebraic-line3.js';
import {pointInPlaneFrame3} from './plane-frame3.js';
import {algebraicCoordinates3,translateAlgebraicPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {algebraicSegment3,restrictAlgebraicSegment3} from './algebraic-segment3.js';
import {fullEllipseArc3,splitEllipticArc3,interiorPointOnEllipticArc3} from './ellipse3.js';
import {intersectPlaneCylinder3} from './plane-cylinder3.js';
import {curveNodingPoints3} from './curve-noding3.js';
import {chartGeometry,duals} from './planar-trim-utils3.js';
import {witness} from './cylinder-plane-split3.js';
import type {Curve3} from './curve3.js';
import {assertOwnedPlanarFaceCurvePartition3} from './planar-face-cylinder-partition3.js';
import type {PlanarFaceCurvePartition3} from './planar-face-cylinder-partition3.js';
import {surfaceGermSides3} from './surface-germ3.js';
import type {SurfaceGermSides3} from './surface-germ3.js';

export type PlanarCellSurfaceClassification3=
 | {readonly kind:'constant';readonly sign:Exclude<Sign,0>;readonly sides:SurfaceGermSides3}
 | {readonly kind:'contained';readonly sides:SurfaceGermSides3}
 | {readonly kind:'cut';readonly point:AlgebraicCoordinates3};
export interface PlanarPartitionSurfaceClassification3 {
 readonly source:PlanarFaceCurvePartition3;readonly surfaces:readonly Surface3[];
 /** Cell index, then surface index. A cut means an interior zero remains. */
 readonly cells:readonly (readonly PlanarCellSurfaceClassification3[])[];
}
/** Certify constant signs on open strip cells, or exhibit an interior zero.
 * Intersect complete supports with each closed cell boundary; split the zero
 * curves at every event before testing interior witnesses. Never infers cell
 * constancy solely from its sample. Boundary zeros are allowed.
 */
export function classifyPlanarPartitionSurfaces3(source:PlanarFaceCurvePartition3,inputs:readonly Surface3[]):PlanarPartitionSurfaceClassification3 {
 assertOwnedPlanarFaceCurvePartition3(source);
 const surfaces=Object.freeze(inputs.map((s):Surface3=>{
  switch(s.kind){
   case 'plane':{const p=s.plane;return Object.freeze({kind:'plane',plane:plane3(p.normal.x,p.normal.y,p.normal.z,p.offset)});}
   case 'cylinder':return Object.freeze({kind:'cylinder',cylinder:cylinder3(s.cylinder.axis,s.cylinder.radiusSquared)});
   default:throw new RangeError('Unknown analytic surface kind');
  }
 }));
 const zeros=planarPartitionSupportCurves3(source,surfaces);
 const cells=Object.freeze(source.cells.map(cell=>Object.freeze(surfaces.map((surface,i):PlanarCellSurfaceClassification3=>{
  const curves=zeros[i]!;
  if(curves===null)return Object.freeze({kind:'contained',sides:surfaceGermSides3(cell.sample,source.base.normal,surface)});
  for(const curve of curves){
   const cuts=cell.boundary.flatMap(b=>curveNodingPoints3(curve,b));
   let samples:readonly AlgebraicCoordinates3[];
   if(curve.kind==='elliptic-arc')samples=splitEllipticArc3(curve.arc,cuts).map(interiorPointOnEllipticArc3);
   else if(curve.kind==='algebraic-segment'){
    const segment=curve.segment,axis=(['x','y','z'] as const).find(k=>segment.start[k].compare(segment.end[k])!==0)!;
    const direction=segment.start[axis].compare(segment.end[axis])<0?1:-1;
    const points=[segment.start,...cuts,segment.end].sort((a,b)=>a[axis].compare(b[axis])*direction).filter((p,j,all)=>j===0||compareAlgebraicPoints3(p,all[j-1]!)!==0);
    samples=points.slice(0,-1).map((p,j)=>{
     const q=points[j+1]!,axes=['x','y','z'] as const;
     if(axes.every(k=>segment.start[k].rational!==null&&segment.end[k].rational!==null)){
      let a=direction===1?p[axis]:q[axis],b=direction===1?q[axis]:p[axis];
      while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}
      const coordinate=a.upper.add(b.lower).div(new Rational(2n)),start=segment.start[axis].rational!,end=segment.end[axis].rational!,t=coordinate.sub(start).div(end.sub(start));
      return algebraicCoordinates3(...axes.map(k=>segment.start[k].rational!.add(segment.end[k].rational!.sub(segment.start[k].rational!).mul(t))) as [Rational,Rational,Rational]);
     }
     const line=commonAlgebraicAxialLine3(segment.start,segment.end),sampleAxis=line?axes.find(k=>line.direction[k].sign()!==0&&line.base[k].rational!==null):undefined;
     if(line&&sampleAxis!==undefined){
      let a=p[sampleAxis],b=q[sampleAxis];if(a.compare(b)>0)[a,b]=[b,a];
      while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}
      const coordinate=a.upper.add(b.lower).div(new Rational(2n)),t=coordinate.sub(line.base[sampleAxis].rational!).div(line.direction[sampleAxis]);
      return translateAlgebraicPoint3(line.base,point3(line.direction.x.mul(t),line.direction.y.mul(t),line.direction.z.mul(t)));
     }
     return witness({kind:'algebraic-segment',segment:restrictAlgebraicSegment3(segment,p,q)});
    });
   }else throw new Error('Unexpected supporting zero curve');
   const point=samples.find(p=>cell.locate(p)==='inside');
   if(point)return Object.freeze({kind:'cut',point});
  }
  const sign=classifyPointToSurface3(cell.sample,surface);
  if(sign===0)throw new Error('Unresolved zero at a planar cell interior sample');
  return Object.freeze({kind:'constant',sign,sides:surfaceGermSides3(cell.sample,source.base.normal,surface)});
 }))));
 return Object.freeze({source,surfaces,cells});
}

/** Internal complete zero carriers for owned planar partitions. Null denotes
 * coincident plane support. Line carriers extend beyond the entire base chart. */
export function planarPartitionSupportCurves3(source:PlanarFaceCurvePartition3,surfaces:readonly Surface3[]):readonly (readonly Curve3[]|null)[] {
 assertOwnedPlanarFaceCurvePartition3(source);
 const chart=chartGeometry(source.base),[U,V]=duals(chart.frame),one=new Rational(1n);
 function bounded(line:AlgebraicLine3):Curve3 {
  const p=pointInPlaneFrame3(chart.frame,line.origin)!;
  const dx=dot3(U,line.direction),dy=dot3(V,line.direction),axis=dx.sign()!==0?'x':'y',rate=axis==='x'?dx:dy;
  const lo=(axis==='x'?chart.xMin:chart.yMin).sub(one),hi=(axis==='x'?chart.xMax:chart.yMax).add(one);
  const at=(q:Rational)=>algebraicLinePoint3(line,AlgebraicReal.fromRational(q).sub(p[axis]).affine(one.div(rate)));
  const start=at(lo),end=at(hi);certifyAlgebraicAxialPair3(start,end,line.origin,line.direction);
  return Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(start,end)});
 }
 const result=surfaces.map((s):readonly Curve3[]|null=>{
  if(s.kind==='plane'){
   const hit=intersectPlanes3(source.base.surface,s.plane);
   return hit.kind==='coincident'?null:hit.kind==='line'?[bounded(algebraicLine3(hit.line.origin,hit.line.direction))]:[];
  }
  const hit=intersectPlaneCylinder3(source.base.surface,s.cylinder);
  return hit.kind==='ellipse'?[Object.freeze({kind:'elliptic-arc',arc:fullEllipseArc3(hit.ellipse)})]:hit.kind==='lines'?hit.lines.map(l=>bounded(l.line)):[];
 });
 return Object.freeze(result.map(curves=>curves===null?null:Object.freeze([...curves])));
}
