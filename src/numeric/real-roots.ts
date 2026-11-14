import { Rational } from './rational.js';
import type { Sign } from './rational.js';
import type { ExactInput } from '../geometry/point2.js';
import { Polynomial, exactRational } from './polynomial.js';

/** Sturm sequence of the monic square-free part. Zero has infinitely many roots. */
export function sturmSequence(input:Polynomial):readonly Polynomial[] {
  if(input.degree<0)throw new RangeError('The zero polynomial has infinitely many roots');
  const p=input.squareFree(),sequence=[p];
  if(p.degree===0)return Object.freeze(sequence);
  sequence.push(p.derivative());
  while(true){
    const remainder=sequence[sequence.length-2]!.divRem(sequence[sequence.length-1]!).remainder;
    if(remainder.degree<0)break;
    sequence.push(remainder.neg());
  }
  return Object.freeze(sequence);
}
function variations(sequence:readonly Polynomial[],point:Rational):number {
  let previous:Sign=0,count=0;
  for(const p of sequence){const sign=p.evaluate(point).sign();if(sign===0)continue;if(previous!==0&&sign!==previous)count++;previous=sign;}
  return count;
}
function countOpen(sequence:readonly Polynomial[],lo:Rational,hi:Rational):number {
  // V(a)-V(b) includes a root at b and excludes one at a. Remove the b endpoint.
  return variations(sequence,lo)-variations(sequence,hi)-(sequence[0]!.evaluate(hi).sign()===0?1:0);
}
/** Number of distinct real roots in the strict open interval (lower, upper).
 * Repeated roots count once; roots equal to either bound are excluded.
 */
export function countRealRoots(input:Polynomial,lower:ExactInput,upper:ExactInput):number {
  const lo=exactRational(lower),hi=exactRational(upper);
  if(lo.compare(hi)>=0)throw new RangeError('Root-count bounds must be strictly increasing');
  return countOpen(sturmSequence(input),lo,hi);
}
function rootBound(p:Polynomial):Rational {
  let max=0n;
  for(let i=0;i<p.degree;i++){
    const ratio=p.coefficients[i]!.div(p.coefficients[p.degree]!);
    const numerator=ratio.numerator<0n?-ratio.numerator:ratio.numerator;
    const ceiling=(numerator+ratio.denominator-1n)/ratio.denominator;
    if(ceiling>max)max=ceiling;
  }
  return new Rational(max+1n);
}
function intervalValue(p:Polynomial,lo:Rational,hi:Rational):readonly [Rational,Rational] {
  let lower=new Rational(0n),upper=lower;
  for(let i=p.degree;i>=0;i--){
    const products=[lower.mul(lo),lower.mul(hi),upper.mul(lo),upper.mul(hi)].sort((a,b)=>a.compare(b));
    lower=products[0]!.add(p.coefficients[i]!);upper=products[3]!.add(p.coefficients[i]!);
  }
  return [lower,upper];
}

/** An exact real algebraic number, specified by a square-free polynomial and its
 * unique real root in a rational open interval, or by an exact rational point.
 * Refinement never mutates existing certificates. No floating-point approximation
 * or general field arithmetic is provided by this initial root representation.
 */
export class AlgebraicReal {
  private constructor(readonly polynomial:Polynomial,readonly lower:Rational,readonly upper:Rational){Object.freeze(this);}
  /** Null means not yet represented as a rational point, not a proof of irrationality. */
  get rational():Rational|null{return this.lower.equals(this.upper)?this.lower:null;}
  static fromRational(input:ExactInput):AlgebraicReal {
    const value=exactRational(input);
    return new AlgebraicReal(new Polynomial([value.neg(),1n]),value,value);
  }
  static isolate(input:Polynomial):readonly AlgebraicReal[] {
    const sequence=sturmSequence(input),p=sequence[0]!;
    if(p.degree===0)return Object.freeze([]);
    if(p.degree===1){const x=p.coefficients[0]!.neg().div(p.coefficients[1]!);return Object.freeze([new AlgebraicReal(p,x,x)]);}
    const bound=rootBound(p),pending=[{lo:bound.neg(),hi:bound,count:countOpen(sequence,bound.neg(),bound)}];
    const result:AlgebraicReal[]=[];
    while(pending.length){
      let {lo,hi,count}=pending.pop()!;
      if(count===0)continue;
      if(count===1){
        // Adjacent isolated roots may initially be interval endpoints. Remove those
        // endpoints before constructing a sign-changing root certificate.
        let exact:Rational|null=null;
        while(p.evaluate(lo).sign()===0||p.evaluate(hi).sign()===0){
          const mid=lo.add(hi).div(new Rational(2n));
          if(p.evaluate(mid).sign()===0){exact=mid;break;}
          if(countOpen(sequence,lo,mid)===1)hi=mid;else lo=mid;
        }
        result.push(exact?new AlgebraicReal(p,exact,exact):new AlgebraicReal(p,lo,hi));
        continue;
      }
      const mid=lo.add(hi).div(new Rational(2n)),atMid=p.evaluate(mid).sign()===0;
      if(atMid)result.push(new AlgebraicReal(p,mid,mid));
      const left=countOpen(sequence,lo,mid),right=countOpen(sequence,mid,hi);
      pending.push({lo,hi:mid,count:left},{lo:mid,hi,count:right});
    }
    result.sort((a,b)=>a.lower.compare(b.lower));
    return Object.freeze(result);
  }
  refine():AlgebraicReal {
    if(this.rational!==null)return this;
    const mid=this.lower.add(this.upper).div(new Rational(2n)),value=this.polynomial.evaluate(mid).sign();
    if(value===0)return new AlgebraicReal(this.polynomial,mid,mid);
    return value===this.polynomial.evaluate(this.lower).sign()?
      new AlgebraicReal(this.polynomial,mid,this.upper):new AlgebraicReal(this.polynomial,this.lower,mid);
  }
  /** Exact rational affine image scale*this + offset, including zero/negative scale. */
  affine(scaleInput:ExactInput,offsetInput:ExactInput=0n):AlgebraicReal {
    const scale=exactRational(scaleInput),offset=exactRational(offsetInput);
    if(scale.sign()===0)return AlgebraicReal.fromRational(offset);
    const map=(x:Rational)=>scale.mul(x).add(offset);
    if(this.rational!==null)return AlgebraicReal.fromRational(map(this.rational));
    const substitute=new Polynomial([offset.neg().div(scale),new Rational(1n).div(scale)]);
    let polynomial=new Polynomial();
    for(let i=this.polynomial.degree;i>=0;i--)polynomial=polynomial.mul(substitute).add(new Polynomial([this.polynomial.coefficients[i]!]));
    const a=map(this.lower),b=map(this.upper);
    return scale.sign()>0?new AlgebraicReal(polynomial.monic(),a,b):new AlgebraicReal(polynomial.monic(),b,a);
  }
  /** Exact sign of another polynomial evaluated at this root, including equality. */
  signOf(input:Polynomial):Sign {
    const reduced=input.divRem(this.polynomial).remainder;
    if(reduced.degree<0)return 0;
    if(this.rational!==null)return reduced.evaluate(this.rational).sign();
    const common=this.polynomial.gcd(reduced);
    if(common.degree>0&&countRealRoots(common,this.lower,this.upper)>0)return 0;
    let root:AlgebraicReal=this;
    while(true){
      if(root.rational!==null)return reduced.evaluate(root.rational).sign();
      const [lo,hi]=intervalValue(reduced,root.lower,root.upper);
      if(lo.sign()>0)return 1;
      if(hi.sign()<0)return -1;
      root=root.refine();
    }
  }
  compare(other:AlgebraicReal):Sign {
    let a:AlgebraicReal=this,b=other;
    if(a.rational!==null&&b.rational!==null)return a.rational.compare(b.rational);
    if(a.upper.compare(b.lower)<=0)return -1;
    if(b.upper.compare(a.lower)<=0)return 1;
    if(a.rational!==null&&b.polynomial.evaluate(a.rational).sign()===0)return 0;
    if(b.rational!==null&&a.polynomial.evaluate(b.rational).sign()===0)return 0;
    if(a.rational===null&&b.rational===null){
      const common=a.polynomial.gcd(b.polynomial);
      const lo=a.lower.compare(b.lower)>0?a.lower:b.lower,hi=a.upper.compare(b.upper)<0?a.upper:b.upper;
      if(common.degree>0&&lo.compare(hi)<0&&countRealRoots(common,lo,hi)>0)return 0;
    }
    while(true){
      if(a.rational!==null&&b.rational!==null)return a.rational.compare(b.rational);
      if(a.upper.compare(b.lower)<=0)return -1;
      if(b.upper.compare(a.lower)<=0)return 1;
      if(a.rational===null&&(b.rational!==null||a.upper.sub(a.lower).compare(b.upper.sub(b.lower))>=0))a=a.refine();else b=b.refine();
    }
  }
}
export function isolateRealRoots(input:Polynomial):readonly AlgebraicReal[]{return AlgebraicReal.isolate(input);}
