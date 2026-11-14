import {Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import type {Rational} from '../numeric/rational.js';
import type {Point3} from './point3.js';
import {snapshotExactPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {plane3} from './plane3.js';
import {cylinder3} from './surface3.js';
import type {Surface3} from './surface3.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3,reverseNurbsCurve3} from './nurbs-curve3.js';
import type {NurbsCurve3} from './nurbs-curve3.js';
import {analyzeNurbsCurve3} from './nurbs-curve-analysis3.js';
import type {NurbsCurveAnalysis3} from './nurbs-curve-analysis3.js';
import {buildBRepTopologyWithAdapter3} from './brep-topology3.js';
import type {BRepTopology3,BRepFaceInput3} from './brep-topology3.js';

export interface PreparedNurbsEdge3 {
  readonly curve:NurbsCurve3;readonly analysis:NurbsCurveAnalysis3;
  readonly start:AlgebraicCoordinates3;readonly end:AlgebraicCoordinates3;readonly closed:boolean;
  /** Forward one-sided tangent germs, with zero-speed endpoints resolved by jets. */
  readonly startTangent:AlgebraicCoordinates3;readonly endTangent:AlgebraicCoordinates3;
  contains(point:Point3|AlgebraicCoordinates3):boolean;
  liesOn(surface:Surface3):boolean;
}
const owned=new WeakSet<PreparedNurbsEdge3>();
export function assertOwnedNurbsEdge3(input:PreparedNurbsEdge3):void {if(!owned.has(input))throw new RangeError('Operation requires a factory-created NURBS edge');}
function contains(curve:NurbsCurve3,input:Point3|AlgebraicCoordinates3):boolean {
  const point=snapshotExactPoint3(input),keys=['x','y','z'] as const;
  for(const span of nurbsCurveSpans3(curve)){
    const key=keys.find(k=>span[k].derivative().mul(span.weight).sub(span[k].mul(span.weight.derivative())).degree>=0)!;
    const value=point[key].recognizeRational(),p=value.polynomial,m=p.degree,N=span[key],W=span.weight,powersN=[new Polynomial([1n])],powersW=[new Polynomial([1n])];
    for(let i=1;i<=m;i++){powersN.push(powersN[i-1]!.mul(N));powersW.push(powersW[i-1]!.mul(W));}
    let equation=new Polynomial();for(let i=0;i<=m;i++)equation=equation.add(powersN[i]!.mul(powersW[m-i]!).scale(p.coefficient(i)));
    if(equation.degree<0)throw new Error('A nonconstant rational coordinate cannot lie in a finite root set identically');
    for(const t of isolateRealRoots(equation)){
      if(t.lower.compare(span.endParameter)>0||t.upper.compare(span.startParameter)<0)continue;
      const exact=t.recognizeRational();
      // Bounds are checked by exact comparison, not just the isolating interval.
      if(exact.compare(pointReal(span.startParameter))<0||exact.compare(pointReal(span.endParameter))>0)continue;
      if(compareAlgebraicPoints3(evaluateNurbsSpanPoint3(span,exact),point)===0)return true;
    }
  }
  return false;
}
function pointReal(value:Rational):AlgebraicReal{return AlgebraicReal.fromRational(value);}
function onSurface(curve:NurbsCurve3,input:Surface3):boolean {
  if(input.kind==='plane'){
    const p=plane3(input.plane.normal.x,input.plane.normal.y,input.plane.normal.z,input.plane.offset);
    return nurbsCurveSpans3(curve).every(s=>s.x.scale(p.normal.x).add(s.y.scale(p.normal.y)).add(s.z.scale(p.normal.z)).add(s.weight.scale(p.offset)).degree<0);
  }
  if(input.kind!=='cylinder')throw new RangeError('Unknown NURBS edge supporting surface');
  const c=cylinder3(input.cylinder.axis,input.cylinder.radiusSquared),d=c.axis.direction,o=c.axis.origin,D=d.x.mul(d.x).add(d.y.mul(d.y)).add(d.z.mul(d.z));
  return nurbsCurveSpans3(curve).every(s=>{
    const x=s.x.sub(s.weight.scale(o.x)),y=s.y.sub(s.weight.scale(o.y)),z=s.z.sub(s.weight.scale(o.z)),a=z.scale(d.y).sub(y.scale(d.z)),b=x.scale(d.z).sub(z.scale(d.x)),e=y.scale(d.x).sub(x.scale(d.y));
    return a.mul(a).add(b.mul(b)).add(e.mul(e)).sub(s.weight.mul(s.weight).scale(c.radiusSquared.mul(D))).degree<0;
  });
}
/** Embedded, interior-G1 interval or simple closed curve. Zero parameter speed
 * is allowed when finite one-sided jets certify the oriented geometric germ.
 */
export function prepareNurbsEdge3(input:NurbsCurve3):PreparedNurbsEdge3 {
  const analysis=analyzeNurbsCurve3(input);
  if(!analysis.continuous)throw new RangeError('NURBS edge must be continuous');
  if(!analysis.interiorG1)throw new RangeError('NURBS edge needs nonconstant spans and interior G1 germs; split at corners or cusps');
  if(!analysis.simple)throw new RangeError('NURBS edge has a self-intersection or repeated image beyond endpoint closure');
  if(!analysis.startTangent||!analysis.endTangent)throw new Error('A nonconstant prepared edge has no endpoint tangent');
  const curve=analysis.curve,result=Object.freeze({curve,analysis,start:analysis.start,end:analysis.end,closed:analysis.closed,startTangent:analysis.startTangent,endTangent:analysis.endTangent,contains:(p:Point3|AlgebraicCoordinates3)=>contains(curve,p),liesOn:(s:Surface3)=>onSurface(curve,s)});owned.add(result);return result;
}
export function reverseNurbsEdge3(input:PreparedNurbsEdge3):PreparedNurbsEdge3 {assertOwnedNurbsEdge3(input);return prepareNurbsEdge3(reverseNurbsCurve3(input.curve));}
/** Real NURBS geometry in the shared incidence engine. Face domains, inter-edge
 * crossings, geometric loop orientation and solid embedding remain uncertified.
 */
export function buildNurbsBRepTopology3(inputEdges:readonly PreparedNurbsEdge3[],faces:readonly BRepFaceInput3[]):BRepTopology3<PreparedNurbsEdge3> {
  return buildBRepTopologyWithAdapter3(inputEdges,faces,{
    snapshot:edge=>{assertOwnedNurbsEdge3(edge);return edge;},endpoints:edge=>[edge.start,edge.end],closed:edge=>edge.closed,onSurface:(edge,surface)=>edge.liesOn(surface),
  });
}
