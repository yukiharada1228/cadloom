import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';
import {assertOwnedNurbsSourcePlaneCellComplex3,nurbsSourcePlaneCellComplexEdgePoint3} from './nurbs-source-plane-cell-complex3.js';
import type {NurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import type {NurbsSpan3} from './nurbs-curve3.js';
import {nurbsBoundaryCoordinateRoots3} from './nurbs-intersection-boundary-nodes3.js';
import {nurbsParameterPolynomial3,composeNurbsSurfaceBoundarySpan3} from './nurbs-surface-boundary3.js';
import {evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {ExactInput} from './point2.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
export interface NurbsPlaneCellRationalMap3 {
 readonly kind:'rational';readonly span:NurbsSpan3;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;
 /** Native cell parameter increases with this sign of the rational parameter. */
 readonly direction:1|-1;
 /** Original UV trim map, or null when the spatial span uses cell native t. */
 readonly parameterSpan:NurbsSpan3|null;
}
export type NurbsPlaneCellRationalMapResult3=NurbsPlaneCellRationalMap3|Readonly<{kind:'unresolved';reason:'implicit-curve-map'|'algebraic-constant-map'|'ambiguous-trim-map'}>;
const owned=new WeakMap<NurbsPlaneCellRationalMap3,Readonly<{cells:NurbsSourcePlaneCellComplex3;edge:number}>>();
function remember(map:NurbsPlaneCellRationalMap3,cells:NurbsSourcePlaneCellComplex3,edge:number):NurbsPlaneCellRationalMap3 {owned.set(map,Object.freeze({cells,edge}));return map;}
export interface NurbsPlaneCellRationalPoint3 {
 readonly parameter:AlgebraicReal;readonly nativeParameter:AlgebraicReal;
 readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly point:AlgebraicCoordinates3;
}
/** Evaluate the certified rational path directly, preserving its common
 * parameter field rather than solving an independent native-u fiber again. */
export function nurbsPlaneCellRationalMapPoint3(map:NurbsPlaneCellRationalMap3,input:AlgebraicReal|ExactInput):NurbsPlaneCellRationalPoint3 {
 const context=owned.get(map);if(!context)throw new RangeError('Expected factory-created cell rational map');
 const t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);if(t.compare(map.lower)<0||t.compare(map.upper)>0)throw new RangeError('Parameter is outside the cell rational map');
 let u:AlgebraicReal,v:AlgebraicReal;
 if(map.parameterSpan){const q=evaluateNurbsSpanPoint3(map.parameterSpan,t);u=q.x;v=q.y;}
 else {const e=context.cells.edges[context.edge]!,path=context.cells.boundaries[e.boundary]!.edges[e.edge]!.path;if(path.kind==='curve')throw new Error('Native rational map lost its constant coordinate');u=path.kind==='u'?path.u:t;v=path.kind==='v'?path.v:t;}
 const e=context.cells.edges[context.edge]!,patch=context.cells.source.complex.source.source.patches[context.cells.source.cells[e.boundary]!.patch]!;
 return Object.freeze({parameter:t,nativeParameter:map.parameterSpan?u:t,u,v,point:liftNurbsSectionPatch3(patch,u,v)});
}
function between(a:AlgebraicReal,b:AlgebraicReal):AlgebraicReal {
 while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return AlgebraicReal.fromRational(a.upper.add(b.lower).div(new Rational(2n)));
}
/** Recover a rational path from a constant coordinate or a finite original
 * Jordan trim. Polynomial identity and branch continuation certify the whole
 * open interval, not just an endpoint or midpoint coincidence. */
export function nurbsPlaneCellRationalMap3(cells:NurbsSourcePlaneCellComplex3,edge:number):NurbsPlaneCellRationalMapResult3 {
 assertOwnedNurbsSourcePlaneCellComplex3(cells);if(!Number.isSafeInteger(edge)||edge<0||edge>=cells.edges.length)throw new RangeError('Invalid cell rational-map edge');
 const e=cells.edges[edge]!,boundary=cells.boundaries[e.boundary]!,path=boundary.edges[e.edge]!.path,cell=cells.source.cells[e.boundary]!,g=cell.graph,P=cells.source.complex.source,p=P.source.patches[cell.patch]!;
 if(path.kind!=='curve'){
  const fixed=(path.kind==='u'?path.u:path.v).recognizeRational().rational;if(fixed===null)return Object.freeze({kind:'unresolved',reason:'algebraic-constant-map'});
  const at=(key:'x'|'y'|'z'|'weight')=>path.kind==='u'?p[key].specializeU(fixed):p[key].specializeV(fixed);
  const span=Object.freeze({index:0,startParameter:path.kind==='u'?g.bounds.vMin:g.bounds.uMin,endParameter:path.kind==='u'?g.bounds.vMax:g.bounds.uMax,x:at('x'),y:at('y'),z:at('z'),weight:at('weight')});
  return remember(Object.freeze({kind:'rational',span,lower:e.lower,upper:e.upper,direction:1,parameterSpan:null}),cells,edge);
 }
 const branch=g.edges[path.edge]!;if(branch.kind!=='branch')throw new Error('Cell strip has a non-branch horizontal boundary');
 const domain=P.source.source.source.source.sharing.boundary.domain,first=cells.vertices[e.from]!.point,last=cells.vertices[e.to]!.point,matches:NurbsPlaneCellRationalMap3[]=[];
 for(const curve of [domain.outer,...domain.holes].flat())for(const span of nurbsCurveSpans3(curve)){
  if(nurbsParameterPolynomial3(g.polynomial,span).degree>=0)continue;
  const inverse=(point:typeof first)=>{
   const roots=nurbsBoundaryCoordinateRoots3(span,'x',point.u);if(roots===null)return [];
   return roots.filter(t=>evaluateNurbsSpanPoint3(span,t).y.compare(point.v)===0);
  };
  const D=span.x.derivative().mul(span.weight).sub(span.x.mul(span.weight.derivative()));if(D.degree<0)continue;
  const critical=D.degree>0?AlgebraicReal.isolate(D):[];
  for(const a of inverse(first))for(const b of inverse(last)){
   const order=a.compare(b);if(!order)continue;const lower=order<0?a:b,upper=order<0?b:a,direction:1|-1=order<0?1:-1;
   if(critical.some(t=>t.compare(lower)>0&&t.compare(upper)<0))continue;
   const t=between(lower,upper),uv=evaluateNurbsSpanPoint3(span,t);
   if(t.signOf(D)!==direction||uv.x.compare(e.lower)<=0||uv.x.compare(e.upper)>=0)continue;
   const selected=evaluateAlgebraicCurveEdge2(g,path.edge,uv.x);if(selected.v.compare(uv.y)!==0)continue;
   // u is strictly monotone onto the cell's native interval. The trim lies
   // identically on the arrangement; with no projection event inside this
   // slab, its connected image cannot switch to another ordered root branch.
   const lifted=composeNurbsSurfaceBoundarySpan3(p,span,lower,upper),spatial=Object.freeze({index:span.index,startParameter:span.startParameter,endParameter:span.endParameter,x:lifted.x,y:lifted.y,z:lifted.z,weight:lifted.weight});
   if(compareAlgebraicPoints3(evaluateNurbsSpanPoint3(spatial,t),nurbsSourcePlaneCellComplexEdgePoint3(cells,edge,uv.x).point)!==0)throw new Error('Recovered trim map lost its spatial lift');
   matches.push(Object.freeze({kind:'rational',span:spatial,lower,upper,direction,parameterSpan:span}));
  }
 }
 if(matches.length!==1)return Object.freeze({kind:'unresolved',reason:matches.length?'ambiguous-trim-map':'implicit-curve-map'});
 return remember(matches[0]!,cells,edge);
}
