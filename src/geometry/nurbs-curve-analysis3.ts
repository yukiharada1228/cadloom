import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import {solveBivariateEquations,divideBivariateExact} from '../numeric/bivariate-system.js';
import {algebraicCoordinates3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {nurbsCurve3,nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import type {NurbsCurve3,NurbsSpan3} from './nurbs-curve3.js';
import {nurbsSpanPairEquations3} from './nurbs-curve-intersection3.js';
import {traceAlgebraicCurve2,evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import type {AlgebraicCurveTopology2} from './algebraic-curve-topology2.js';

export type NurbsStationary3=
 | {readonly span:number;readonly kind:'span';readonly startParameter:Rational;readonly endParameter:Rational}
 | {readonly span:number;readonly kind:'points';readonly points:readonly {readonly parameter:AlgebraicReal;readonly jetOrder:number;readonly interior:boolean}[]};
export interface NurbsCurveJoin3 {readonly parameter:Rational;readonly continuous:boolean;readonly c1:boolean;readonly g1:boolean;}
export interface NurbsRepeatWitness3 {
  readonly kind:'isolated'|'overlap'|'constant';readonly firstSpan:number;readonly secondSpan:number;
  readonly firstParameter:AlgebraicReal;readonly secondParameter:AlgebraicReal;readonly point:AlgebraicCoordinates3;
  readonly endpointClosure:boolean;
}
export interface NurbsCurveAnalysis3 {
  readonly curve:NurbsCurve3;readonly start:AlgebraicCoordinates3;readonly end:AlgebraicCoordinates3;
  readonly startTangent:AlgebraicCoordinates3|null;readonly endTangent:AlgebraicCoordinates3|null;
  readonly closed:boolean;readonly closureTangentsAligned:boolean;
  readonly joins:readonly NurbsCurveJoin3[];readonly stationary:readonly NurbsStationary3[];
  readonly continuous:boolean;readonly parameterRegular:boolean;
  /** Oriented G1 regular image on the OPEN global parameter interval; odd-order
   * stationary reparameterizations are allowed. Endpoints have one-sided germs.
   */
  readonly interiorG1:boolean;
  /** Exact strict-monotonicity certificate, if available; not a sampled heuristic. */
  readonly monotoneCoordinate:'x'|'y'|'z'|null;readonly monotoneDirection:-1|1|null;
  /** No equal positions at distinct parameters; continuity is reported separately. */
  readonly injective:boolean;
  /** Continuous embedding of an interval, or a circle with only endpoint closure. */
  readonly simple:boolean;
  /** Counterexamples, not an enumeration of the complete self-intersection set.
   * Search stops once an invalid non-endpoint repetition is established.
   */
  readonly repetitions:readonly NurbsRepeatWitness3[];
}
const real=(x:Rational)=>AlgebraicReal.fromRational(x),keys=['x','y','z'] as const,diagonal=new BivariatePolynomial([[0n,-1n],[1n]]);
function between(inputA:AlgebraicReal,inputB:AlgebraicReal):Rational {let a=inputA,b=inputB;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
function inside(t:AlgebraicReal,s:NurbsSpan3):boolean{return t.compare(real(s.startParameter))>=0&&t.compare(real(s.endParameter))<=0;}
function derivativePolynomials(s:NurbsSpan3):readonly Polynomial[]{return keys.map(k=>s[k].derivative().mul(s.weight).sub(s[k].mul(s.weight.derivative())));}
/** First nonzero jet numerator of C(t)-C(t0); denominator W(t0)^2 is positive. */
function jet(s:NurbsSpan3,t:AlgebraicReal):{order:number;vector:AlgebraicCoordinates3}|null {
  let numerators=keys.map(k=>s[k]),weight=s.weight;
  const bound=Math.max(s.x.degree,s.y.degree,s.z.degree,s.weight.degree);
  for(let order=1;order<=bound;order++){
    numerators=numerators.map(p=>p.derivative());weight=weight.derivative();
    const values=numerators.map((p,i)=>t.rationalFunction(p.mul(s.weight).sub(s[keys[i]!]!.mul(weight))));
    if(values.some(x=>x.sign()!==0))return {order,vector:algebraicCoordinates3(values[0]!,values[1]!,values[2]!)};
  }
  return null;
}
function tangent(s:NurbsSpan3,t:AlgebraicReal,side:'left'|'right'):AlgebraicCoordinates3|null {
  const j=jet(s,t);if(!j)return null;const sign=side==='left'&&j.order%2===0?-1n:1n;
  return algebraicCoordinates3(j.vector.x.affine(sign),j.vector.y.affine(sign),j.vector.z.affine(sign));
}
function sameRay(a:AlgebraicCoordinates3|null,b:AlgebraicCoordinates3|null):boolean {
  if(!a||!b)return false;
  return a.y.mul(b.z).sub(a.z.mul(b.y)).sign()===0&&a.z.mul(b.x).sub(a.x.mul(b.z)).sign()===0&&a.x.mul(b.y).sub(a.y.mul(b.x)).sign()===0&&a.x.mul(b.x).add(a.y.mul(b.y)).add(a.z.mul(b.z)).sign()>0;
}
function monotoneCoordinate(spans:readonly NurbsSpan3[]):{key:'x'|'y'|'z';direction:-1|1}|null {
  for(const key of keys){let direction:0|-1|1=0,valid=true;
    for(const s of spans){
      const p=s[key].derivative().mul(s.weight).sub(s[key].mul(s.weight.derivative()));if(p.degree<0){valid=false;break;}
      const roots=isolateRealRoots(p).filter(t=>t.compare(real(s.startParameter))>0&&t.compare(real(s.endParameter))<0),cuts=[real(s.startParameter),...roots,real(s.endParameter)];
      for(let i=0;i+1<cuts.length;i++){
        const sign=p.evaluate(between(cuts[i]!,cuts[i+1]!)).sign();if(sign===0)throw new Error('A derivative sign cell contains an unrecorded root');
        if(direction!==0&&direction!==sign){valid=false;break;}direction=sign;
      }
      if(!valid)break;
    }
    if(valid&&direction!==0)return {key,direction};
  }
  return null;
}
function overlapWitness(t:AlgebraicCurveTopology2,sameSpan:boolean):{u:AlgebraicReal;v:AlgebraicReal}|null {
  if(t.kind==='area')return {u:real(t.bounds.uMin.mul(new Rational(2n)).add(t.bounds.uMax).div(new Rational(3n))),v:real(t.bounds.vMin.add(t.bounds.vMax.mul(new Rational(2n))).div(new Rational(3n)))};
  for(let id=0;id<t.edges.length;id++){
    const e=t.edges[id]!,a=t.vertices[e.from]!,b=t.vertices[e.to]!;
    if(!sameSpan)return e.sample;
    if(e.kind==='branch'){
      const d=t.polynomial.diagonal();if(d.degree<0)throw new Error('Nonconstant same-span coincidence retained a diagonal factor');let q=between(a.u,b.u);
      while(d.evaluate(q).sign()===0)q=between(real(q),b.u);return evaluateAlgebraicCurveEdge2(t,id,q);
    }
    let q=between(a.v,b.v);while(real(q).compare(a.u)===0)q=between(real(q),b.v);return evaluateAlgebraicCurveEdge2(t,id,q);
  }
  return null;
}
/** Exact continuity, stationary jets and distinct-parameter repetition analysis. */
export function analyzeNurbsCurve3(input:NurbsCurve3):NurbsCurveAnalysis3 {
  const curve=nurbsCurve3(input.degree,input.controlPoints,input.knots,input.weights),spans=nurbsCurveSpans3(curve),first=spans[0]!,last=spans[spans.length-1]!,start=evaluateNurbsSpanPoint3(first,real(curve.startParameter)),end=evaluateNurbsSpanPoint3(last,real(curve.endParameter)),closed=compareAlgebraicPoints3(start,end)===0,stationary:NurbsStationary3[]=[],joins:NurbsCurveJoin3[]=[],constants=new Set<number>();let interiorG1=true;
  for(const s of spans){
    const p=derivativePolynomials(s).reduce((g,f)=>g.gcd(f),new Polynomial());
    if(p.degree<0){constants.add(s.index);interiorG1=false;stationary.push(Object.freeze({span:s.index,kind:'span',startParameter:s.startParameter,endParameter:s.endParameter}));continue;}
    const roots=isolateRealRoots(p).filter(t=>inside(t,s)),points=roots.map(parameter=>{
      const j=jet(s,parameter);if(!j)throw new Error('A nonconstant span has no finite nonzero jet');const interior=parameter.compare(real(s.startParameter))>0&&parameter.compare(real(s.endParameter))<0;if(interior&&j.order%2===0)interiorG1=false;
      return Object.freeze({parameter,jetOrder:j.order,interior});
    });if(points.length)stationary.push(Object.freeze({span:s.index,kind:'points',points:Object.freeze(points)}));
  }
  for(let i=1;i<spans.length;i++){
    const a=spans[i-1]!,b=spans[i]!,t=real(b.startParameter),continuous=compareAlgebraicPoints3(evaluateNurbsSpanPoint3(a,t),evaluateNurbsSpanPoint3(b,t))===0,g1=continuous&&sameRay(tangent(a,t,'left'),tangent(b,t,'right'));
    const derivative=(s:NurbsSpan3)=>derivativePolynomials(s).map(p=>t.rationalFunction(p,s.weight.mul(s.weight))),A=derivative(a),B=derivative(b),c1=continuous&&A.every((x,j)=>x.compare(B[j]!)===0);
    joins.push(Object.freeze({parameter:b.startParameter,continuous,c1,g1}));if(!g1)interiorG1=false;
  }
  const continuous=joins.every(j=>j.continuous),monotone=continuous&&!closed?monotoneCoordinate(spans):null,repetitions:NurbsRepeatWitness3[]=[];
  const record=(a:NurbsSpan3,b:NurbsSpan3,u:AlgebraicReal,v:AlgebraicReal,kind:NurbsRepeatWitness3['kind']):boolean=>{
    if(u.compare(v)===0)return false;const point=evaluateNurbsSpanPoint3(a,u);if(compareAlgebraicPoints3(point,evaluateNurbsSpanPoint3(b,v))!==0)throw new Error('A repetition witness does not match in space');let A=a.index,B=b.index;if(u.compare(v)>0){[u,v]=[v,u];[A,B]=[B,A];}
    const endpointClosure=closed&&u.compare(real(curve.startParameter))===0&&v.compare(real(curve.endParameter))===0;
    if(!repetitions.some(p=>p.firstParameter.compare(u)===0&&p.secondParameter.compare(v)===0))repetitions.push(Object.freeze({kind,firstSpan:A,secondSpan:B,firstParameter:u,secondParameter:v,point,endpointClosure}));return !endpointClosure;
  };
  const constant=spans.find(s=>constants.has(s.index));
  if(constant){const s=constant,u=real(s.startParameter.mul(new Rational(2n)).add(s.endParameter).div(new Rational(3n))),v=real(s.startParameter.add(s.endParameter.mul(new Rational(2n))).div(new Rational(3n)));record(s,s,u,v,'constant');}
  else if(!monotone)search:for(let i=0;i<spans.length;i++)for(let j=i;j<spans.length;j++){
    const a=spans[i]!,b=spans[j]!,equations=nurbsSpanPairEquations3(a,b).map(f=>i===j?divideBivariateExact(f,diagonal):f),result=solveBivariateEquations(equations);
    for(const p of result.points)if(inside(p.u,a)&&inside(p.v,b)&&record(a,b,p.u,p.v,'isolated'))break search;
    if(result.kind!=='finite'){
      const t=traceAlgebraicCurve2(result.commonFactor,{uMin:a.startParameter,uMax:a.endParameter,vMin:b.startParameter,vMax:b.endParameter});
      for(const p of t.vertices)if(record(a,b,p.u,p.v,'isolated'))break search;
      const p=overlapWitness(t,i===j);if(p&&record(a,b,p.u,p.v,'overlap'))break search;
    }
  }
  const startTangent=tangent(first,real(curve.startParameter),'right'),endTangent=tangent(last,real(curve.endParameter),'left');
  return Object.freeze({curve,start,end,startTangent,endTangent,closed,closureTangentsAligned:sameRay(startTangent,endTangent),joins:Object.freeze(joins),stationary:Object.freeze(stationary),continuous,parameterRegular:stationary.length===0,interiorG1:continuous&&interiorG1,monotoneCoordinate:monotone?.key??null,monotoneDirection:monotone?.direction??null,injective:repetitions.length===0,simple:continuous&&repetitions.every(p=>p.endpointClosure),repetitions:Object.freeze(repetitions)});
}
