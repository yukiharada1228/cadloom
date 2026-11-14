import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {nurbsCurve3,nurbsCurveSpans3,evaluateNurbsCurve3} from './nurbs-curve3.js';
import type {NurbsCurve3,NurbsSpan3} from './nurbs-curve3.js';
import {analyzeNurbsCurve3} from './nurbs-curve-analysis3.js';
import {intersectNurbsCurves3} from './nurbs-curve-intersection3.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';

export type NurbsDomainLocation2='inside'|'boundary'|'outside';
export interface PreparedNurbsParameterDomain2 {
  readonly outer:readonly NurbsCurve3[];readonly holes:readonly (readonly NurbsCurve3[])[];
  readonly sense:1|-1;
  readonly sample:Readonly<{u:Rational;v:Rational}>;
  locate(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):NurbsDomainLocation2;
}
const one=new Polynomial([1n]),real=(x:AlgebraicReal|ExactInput)=>x instanceof AlgebraicReal?x:AlgebraicReal.fromRational(x);
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Exact preimages of an algebraic coordinate, filtered against its real branch. */
function preimages(s:NurbsSpan3,key:'x'|'y',value:AlgebraicReal):readonly AlgebraicReal[]|null {
  const N=s[key],W=s.weight;
  if(N.derivative().mul(W).sub(N.mul(W.derivative())).degree<0)return real(N.evaluate(s.startParameter).div(W.evaluate(s.startParameter))).compare(value)===0?null:[];
  const P=value.recognizeRational().polynomial,n=P.degree,NP=[one],WP=[one];for(let i=1;i<=n;i++){NP.push(NP[i-1]!.mul(N));WP.push(WP[i-1]!.mul(W));}
  let f=new Polynomial();for(let i=0;i<=n;i++)f=f.add(NP[i]!.mul(WP[n-i]!).scale(P.coefficient(i)));
  return isolateRealRoots(f).filter(t=>t.compare(real(s.startParameter))>=0&&t.compare(real(s.endParameter))<=0&&t.rationalFunction(N,W).compare(value)===0);
}
function winding(ring:readonly NurbsCurve3[],u:AlgebraicReal,v:AlgebraicReal):number|null {
  let result=0;
  for(const c of ring)for(const s of nurbsCurveSpans3(c)){
    const roots=preimages(s,'y',v);
    if(roots===null){const xs=preimages(s,'x',u);if(xs===null||xs.length)return null;continue;}
    const lo=real(s.startParameter),hi=real(s.endParameter);
    for(let i=0;i<roots.length;i++){
      const t=roots[i]!,x=t.rationalFunction(s.x,s.weight),cmp=x.compare(u);if(cmp===0)return null;if(cmp<0)continue;
      const side=(a:AlgebraicReal,b:AlgebraicReal)=>{const q=between(a,b);return real(s.y.evaluate(q).div(s.weight.evaluate(q))).compare(v);};
      const left=t.compare(lo)>0?side(i?roots[i-1]!:lo,t):0;
      const right=t.compare(hi)<0?side(t,i+1<roots.length?roots[i+1]!:hi):0;
      // Half-open horizontal ray: positive-side germs count at zero endpoints.
      if(left<=0&&right>0)result++;if(left>0&&right<=0)result--;
    }
  }
  return result;
}
function ringLocation(ring:readonly NurbsCurve3[],u:AlgebraicReal,v:AlgebraicReal):NurbsDomainLocation2 {const w=winding(ring,u,v);return w===null?'boundary':w===0?'outside':'inside';}
function validateRing(input:readonly NurbsCurve3[]):readonly NurbsCurve3[] {
  if(!input.length)throw new RangeError('A boundary ring must contain curves');
  const ring=Object.freeze(input.map(c=>nurbsCurve3(c.degree,c.controlPoints,c.knots,c.weights))),reports=ring.map(analyzeNurbsCurve3);
  for(let i=0;i<ring.length;i++){
    if(ring[i]!.controlPoints.some(p=>p.z.sign()!==0)||!reports[i]!.simple)throw new RangeError('Boundary curves must be planar, continuous and simple');
    if(ring.length>1&&reports[i]!.closed)throw new RangeError('A closed curve must form its own ring');
    if(compareAlgebraicPoints3(reports[i]!.end,reports[(i+1)%ring.length]!.start)!==0)throw new RangeError('Boundary curves must form a closed chain');
  }
  for(let i=0;i<ring.length;i++)for(let j=i+1;j<ring.length;j++){
    const allowed:AlgebraicCoordinates3[]=[];if(j===i+1)allowed.push(reports[i]!.end);if(i===0&&j===ring.length-1)allowed.push(reports[0]!.start);
    checkIntersections(ring[i]!,ring[j]!,allowed);
  }
  return ring;
}
function checkIntersections(a:NurbsCurve3,b:NurbsCurve3,allowed:readonly AlgebraicCoordinates3[]):void {
  const hit=intersectNurbsCurves3(a,b),accept=(p:AlgebraicCoordinates3)=>allowed.some(q=>compareAlgebraicPoints3(p,q)===0);
  if(hit.points.some(p=>!accept(p.point)))throw new RangeError('Boundary rings cross or touch away from adjacent endpoints');
  for(const r of hit.relations){
    if(r.topology.kind==='area'||r.topology.edges.length)throw new RangeError('Boundary curves overlap');
    if(r.topology.vertices.some(p=>!accept(evaluateNurbsCurve3(a,p.u))))throw new RangeError('Boundary rings cross or touch away from adjacent endpoints');
  }
}
function interior(ring:readonly NurbsCurve3[],accept:(u:Rational,v:Rational)=>boolean=()=>true):{u:Rational;v:Rational;winding:number} {
  const s=nurbsCurveSpans3(ring[0]!)[0]!,dx=s.x.derivative().mul(s.weight).sub(s.x.mul(s.weight.derivative())),dy=s.y.derivative().mul(s.weight).sub(s.y.mul(s.weight.derivative()));let t=s.startParameter.add(s.endParameter).div(new Rational(2n));
  while(dx.evaluate(t).sign()===0&&dy.evaluate(t).sign()===0)t=t.add(s.endParameter).div(new Rational(2n));
  const W=s.weight.evaluate(t),u=s.x.evaluate(t).div(W),v=s.y.evaluate(t).div(W),nx=dy.evaluate(t).neg(),ny=dx.evaluate(t);let scale=new Rational(1n);
  for(;;){for(const sign of [1n,-1n]){const q=scale.mul(new Rational(sign)),a=u.add(nx.mul(q)),b=v.add(ny.mul(q)),w=winding(ring,real(a),real(b));if(w!==null&&w!==0&&accept(a,b))return {u:a,v:b,winding:w};}scale=scale.div(new Rational(2n));}
}
/** Validate a connected oriented Jordan domain in PARAMETER space only.
 * Requires one outer ring, disjoint unnested holes and no boundary contacts.
 * Does not assert that a surface mapping of this domain is embedded.
 */
export function prepareNurbsParameterDomain2(inputOuter:readonly NurbsCurve3[],inputHoles:readonly (readonly NurbsCurve3[])[]=[],sense:1|-1=1):PreparedNurbsParameterDomain2 {
  if(sense!==1&&sense!==-1)throw new RangeError('Domain sense must be +1 or -1');
  const outer=validateRing(inputOuter),holes=Object.freeze(inputHoles.map(validateRing)),rings=[outer,...holes];
  for(let i=0;i<rings.length;i++)for(let j=i+1;j<rings.length;j++)for(const a of rings[i]!)for(const b of rings[j]!)checkIntersections(a,b,[]);
  const samples=rings.map(r=>interior(r));if(samples[0]!.winding!==sense||samples.slice(1).some(p=>p.winding!==-sense))throw new RangeError('Outer and hole orientations must agree with domain sense');
  const starts=holes.map(r=>evaluateNurbsCurve3(r[0]!,r[0]!.startParameter));
  for(let i=0;i<holes.length;i++){
    const p=starts[i]!;if(ringLocation(outer,p.x,p.y)!=='inside')throw new RangeError('Holes must lie strictly inside the outer ring');
    for(let j=0;j<holes.length;j++)if(i!==j&&ringLocation(holes[j]!,p.x,p.y)!=='outside')throw new RangeError('Holes must not nest');
  }
  const locate=(u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput):NurbsDomainLocation2=>{
    const a=real(u),b=real(v),out=ringLocation(outer,a,b);if(out!=='inside')return out;
    for(const h of holes){const where=ringLocation(h,a,b);if(where==='boundary')return where;if(where==='inside')return 'outside';}return 'inside';
  };
  // A normal offset near the outer boundary eventually avoids every disjoint hole.
  const sample=interior(outer,(u,v)=>locate(u,v)==='inside');
  return Object.freeze({outer,holes,sense,sample:Object.freeze({u:sample.u,v:sample.v}),locate});
}
