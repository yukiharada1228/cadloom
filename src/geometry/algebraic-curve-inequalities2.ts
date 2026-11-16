import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {solveBivariateSystem,bivariateFiberRoots} from '../numeric/bivariate-system.js';
import type {BivariateRoot} from '../numeric/bivariate-system.js';
import {traceAlgebraicCurve2,assertOwnedAlgebraicCurveTopology2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import type {AlgebraicCurveTopology2,CurveRectangle2} from './algebraic-curve-topology2.js';
import type {RestrictedAlgebraicCurve2} from './algebraic-curve-rectangle2.js';
export interface InequalityRestrictedAlgebraicCurve2 {readonly graph:AlgebraicCurveTopology2;readonly vertices:readonly BivariateRoot[];readonly edges:RestrictedAlgebraicCurve2['edges'];}
const real=(x:Rational)=>AlgebraicReal.fromRational(x);
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
const accepts=(fs:readonly BivariatePolynomial[],q:BivariateRoot)=>fs.every(f=>f.evaluateAlgebraic(q.u,q.v).sign()>=0);
/** Internal complete polynomial event partition on closed graph subintervals.
 * A divisor containing an open branch is identically zero there; its meetings
 * with other branches are already source graph endpoint events. */
export function prepareAlgebraicCurvePolynomialCuts2(graph:AlgebraicCurveTopology2,input:readonly BivariatePolynomial[]) {
 assertOwnedAlgebraicCurveTopology2(graph);if(graph.kind==='area')throw new RangeError('Polynomial cuts require a curve graph');const polynomials=Object.freeze(input.filter(f=>f.degreeU>0||f.degreeV>0)),solutions=polynomials.map(f=>solveBivariateSystem(graph.nonvertical,f));
 return (sourceEdge:number,lower:AlgebraicReal,upper:AlgebraicReal):readonly AlgebraicReal[]=>{
  if(!Number.isSafeInteger(sourceEdge)||sourceEdge<0||sourceEdge>=graph.edges.length)throw new RangeError('Invalid polynomial cut source edge');const e=graph.edges[sourceEdge]!,axis=e.kind==='branch'?'u':'v';if(lower.compare(upper)>=0||lower.compare(graph.vertices[e.from]![axis])<0||upper.compare(graph.vertices[e.to]![axis])>0)throw new RangeError('Invalid polynomial cut subinterval');const cuts=[lower,upper];
  const add=(t:AlgebraicReal,expectedV?:AlgebraicReal)=>{if(t.compare(lower)<=0||t.compare(upper)>=0||cuts.some(q=>q.compare(t)===0))return;const q=evaluateAlgebraicCurveEdge2(graph,sourceEdge,t);if(expectedV===undefined||q.v.compare(expectedV)===0)cuts.push(t);};
  polynomials.forEach((f,i)=>{if(e.kind==='vertical'){const fiber=bivariateFiberRoots(f,e.sample.u);if(fiber.kind==='finite')fiber.roots.forEach(t=>add(t));}else{const result=solutions[i]!;if(result.commonFactor.evaluateAlgebraic(e.sample.u,e.sample.v).sign()!==0)result.points.forEach(q=>add(q.u,q.v));}});
  return Object.freeze(cuts.sort((a,b)=>a.compare(b)));
 };
}
/** Internal complete closed restriction to a conjunction of F(u,v)>=0. */
export function restrictAlgebraicCurveInequalities2(graph:AlgebraicCurveTopology2,constraints:readonly BivariatePolynomial[]):InequalityRestrictedAlgebraicCurve2 {
 const partition=prepareAlgebraicCurvePolynomialCuts2(graph,constraints),vertices:BivariateRoot[]=[],edges:RestrictedAlgebraicCurve2['edges'][number][]=[];
 const add=(q:BivariateRoot)=>{let id=vertices.findIndex(p=>p.u.compare(q.u)===0&&p.v.compare(q.v)===0);if(id<0){id=vertices.length;vertices.push(Object.freeze({u:q.u,v:q.v}));}return id;};
 graph.vertices.filter(q=>accepts(constraints,q)).forEach(add);
 graph.edges.forEach((e,sourceEdge)=>{
  const axis=e.kind==='branch'?'u':'v',cuts=partition(sourceEdge,graph.vertices[e.from]![axis],graph.vertices[e.to]![axis]);for(const t of cuts){const q=evaluateAlgebraicCurveEdge2(graph,sourceEdge,t);if(accepts(constraints,q))add(q);}
  for(let i=0;i+1<cuts.length;i++){const lower=cuts[i]!,upper=cuts[i+1]!;if(!accepts(constraints,evaluateAlgebraicCurveEdge2(graph,sourceEdge,between(lower,upper))))continue;const a=evaluateAlgebraicCurveEdge2(graph,sourceEdge,lower),b=evaluateAlgebraicCurveEdge2(graph,sourceEdge,upper);if(!accepts(constraints,a)||!accepts(constraints,b))throw new Error('Closed inequality restriction lost an endpoint');edges.push(Object.freeze({sourceEdge,lower,upper,from:add(a),to:add(b)}));}
 });
 return Object.freeze({graph,vertices:Object.freeze(vertices),edges:Object.freeze(edges)});
}
/** Internal sign-cell enumeration. Caller must supply a polynomial arrangement
 * on every stratum of which the acceptance predicate is constant. */
export function witnessBivariatePartition2(polynomials:readonly BivariatePolynomial[],bounds:CurveRectangle2,accept:(q:BivariateRoot)=>boolean):BivariateRoot|null {
 if(bounds.uMin.compare(bounds.uMax)>=0||bounds.vMin.compare(bounds.vMax)>=0)throw new RangeError('Witness rectangle must have positive extent');let product=new BivariatePolynomial([[1n]]);const seen:BivariatePolynomial[]=[];
 for(const f of polynomials)if((f.degreeU>0||f.degreeV>0)&&!seen.some(q=>q.equals(f))){seen.push(f);product=product.mul(f);}
 const graph=traceAlgebraicCurve2(product,bounds),us=[...graph.slabs.map(s=>real(s.sampleU)),...graph.events.map(e=>e.u)],vMin=real(bounds.vMin),vMax=real(bounds.vMax);
 for(const u of us){const fiber=bivariateFiberRoots(graph.nonvertical,u);if(fiber.kind==='whole')throw new Error('Primitive arrangement has a whole nonvertical fiber');const cuts=[vMin,vMax,...fiber.roots.filter(v=>v.compare(vMin)>=0&&v.compare(vMax)<=0)].sort((a,b)=>a.compare(b)).filter((v,i,all)=>i===0||v.compare(all[i-1]!)!==0),vs=[...cuts.slice(0,-1).map((v,i)=>real(between(v,cuts[i+1]!))),...cuts];for(const v of vs){const q=Object.freeze({u,v});if(accept(q))return q;}}
 return null;
}
/** Complete nonemptiness witness for closed polynomial inequalities. */
export function witnessBivariateInequalities2(constraints:readonly BivariatePolynomial[],bounds:CurveRectangle2):BivariateRoot|null {
 if(bounds.uMin.compare(bounds.uMax)>=0||bounds.vMin.compare(bounds.vMax)>=0)throw new RangeError('Witness rectangle must have positive extent');if(constraints.some(f=>f.degreeU<=0&&f.degreeV<=0&&f.coefficient(0,0).sign()<0))return null;return witnessBivariatePartition2(constraints,bounds,q=>accepts(constraints,q));
}
