import { Rational } from './rational.js';
import type { ExactInput } from '../geometry/point2.js';

export function exactRational(value:ExactInput):Rational {
  if(value instanceof Rational)return value;
  if(typeof value==='bigint')return new Rational(value);
  if(typeof value==='string')return Rational.parse(value);
  throw new TypeError('Expected Rational, bigint or exact string');
}
const zero=new Rational(0n);
/** Immutable polynomial over Q; coefficients are in ascending power order.
 * The zero polynomial has an empty coefficient array and degree -1.
 */
export class Polynomial {
  readonly coefficients:readonly Rational[];
  constructor(coefficients:readonly ExactInput[]=[]){
    const values=coefficients.map(exactRational);
    while(values.length&&values[values.length-1]!.sign()===0)values.pop();
    this.coefficients=Object.freeze(values);Object.freeze(this);
  }
  get degree():number{return this.coefficients.length-1;}
  coefficient(index:number):Rational {
    if(!Number.isSafeInteger(index)||index<0)throw new RangeError('Invalid coefficient index');
    return this.coefficients[index]??zero;
  }
  evaluate(input:ExactInput):Rational {
    const x=exactRational(input);
    let value=zero;
    for(let i=this.degree;i>=0;i--)value=value.mul(x).add(this.coefficients[i]!);
    return value;
  }
  add(other:Polynomial):Polynomial {
    return new Polynomial(Array.from({length:Math.max(this.degree,other.degree)+1},(_,i)=>this.coefficient(i).add(other.coefficient(i))));
  }
  neg():Polynomial{return new Polynomial(this.coefficients.map(c=>c.neg()));}
  sub(other:Polynomial):Polynomial{return this.add(other.neg());}
  scale(input:ExactInput):Polynomial {
    const value=exactRational(input);return new Polynomial(this.coefficients.map(c=>c.mul(value)));
  }
  mul(other:Polynomial):Polynomial {
    if(this.degree<0||other.degree<0)return new Polynomial();
    const values:Rational[]=Array.from({length:this.degree+other.degree+1},()=>zero);
    this.coefficients.forEach((a,i)=>other.coefficients.forEach((b,j)=>{values[i+j]=values[i+j]!.add(a.mul(b));}));
    return new Polynomial(values);
  }
  derivative():Polynomial {
    return new Polynomial(this.coefficients.slice(1).map((c,i)=>c.mul(new Rational(BigInt(i+1)))));
  }
  divRem(divisor:Polynomial):{readonly quotient:Polynomial;readonly remainder:Polynomial}{
    if(divisor.degree<0)throw new RangeError('Polynomial division by zero');
    const remainder=[...this.coefficients];
    const quotient:Rational[]=Array.from({length:Math.max(0,this.degree-divisor.degree+1)},()=>zero);
    while(remainder.length-1>=divisor.degree){
      const shift=remainder.length-1-divisor.degree;
      const factor=remainder[remainder.length-1]!.div(divisor.coefficients[divisor.degree]!);
      quotient[shift]=factor;
      divisor.coefficients.forEach((c,i)=>{remainder[i+shift]=remainder[i+shift]!.sub(c.mul(factor));});
      while(remainder.length&&remainder[remainder.length-1]!.sign()===0)remainder.pop();
    }
    return Object.freeze({quotient:new Polynomial(quotient),remainder:new Polynomial(remainder)});
  }
  monic():Polynomial {
    return this.degree<0?this:this.scale(new Rational(1n).div(this.coefficients[this.degree]!));
  }
  gcd(other:Polynomial):Polynomial {
    let a:Polynomial=this,b=other;
    while(b.degree>=0){const r=a.divRem(b).remainder;a=b;b=r;}
    return a.monic();
  }
  /** Same distinct roots, each simple; zero stays zero, nonzero constants become 1. */
  squareFree():Polynomial {
    if(this.degree<=0)return this.monic();
    return this.divRem(this.gcd(this.derivative())).quotient.monic();
  }
  equals(other:Polynomial):boolean {
    return this.degree===other.degree&&this.coefficients.every((c,i)=>c.equals(other.coefficients[i]!));
  }
}
