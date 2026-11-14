import { Polynomial } from './polynomial.js';
import { Rational } from './rational.js';

const zero=new Polynomial(),one=new Polynomial([1n]);
/** Internal resultant over Q[X], eliminating T. Coefficient arrays ascend in T.
 * Exact fraction-free Sylvester elimination; no polynomial pivot approximation.
 */
export function resultantInParameter(first:readonly Polynomial[],second:readonly Polynomial[]):Polynomial {
  const p=[...first],q=[...second];
  while(p.length&&p[p.length-1]!.degree<0)p.pop();
  while(q.length&&q[q.length-1]!.degree<0)q.pop();
  if(!p.length||!q.length)return zero;
  const m=p.length-1,n=q.length-1,size=m+n;
  if(size===0)return one;
  const matrix:Polynomial[][]=Array.from({length:size},()=>Array.from({length:size},()=>zero));
  for(let i=0;i<n;i++)for(let j=0;j<=m;j++)matrix[i]![i+j]=p[m-j]!;
  for(let i=0;i<m;i++)for(let j=0;j<=n;j++)matrix[n+i]![i+j]=q[n-j]!;
  let previous=one,sign=1;
  for(let k=0;k<size-1;k++){
    let row=k;
    while(row<size&&matrix[row]![k]!.degree<0)row++;
    if(row===size)return zero;
    if(row!==k){[matrix[k],matrix[row]]=[matrix[row]!,matrix[k]!];sign=-sign;}
    const pivot=matrix[k]![k]!;
    for(let i=k+1;i<size;i++){
      for(let j=k+1;j<size;j++){
        const numerator=matrix[i]![j]!.mul(pivot).sub(matrix[i]![k]!.mul(matrix[k]![j]!));
        const division=numerator.divRem(previous);
        if(division.remainder.degree>=0)throw new Error('Nonexact Bareiss polynomial division');
        matrix[i]![j]=division.quotient;
      }
      matrix[i]![k]=zero;
    }
    previous=pivot;
  }
  const determinant=matrix[size-1]![size-1]!;
  return sign===1?determinant:determinant.neg();
}
/** Rational univariate Sylvester resultant. Zero inputs give 0; two nonzero
 * constants give 1 (the empty-determinant convention).
 */
export function polynomialResultant(p:Polynomial,q:Polynomial):Rational {
  return resultantInParameter(p.coefficients.map(c=>new Polynomial([c])),q.coefficients.map(c=>new Polynomial([c]))).coefficient(0);
}
/** A nonzero polynomial vanishing at a+b for p(a)=q(b)=0. */
export function sumElimination(p:Polynomial,q:Polynomial):Polynomial {
  const X=new Polynomial([0n,1n]);
  let coefficients:Polynomial[]=[];
  // Horner composition q(X-T) in Q[X][T].
  for(let i=q.degree;i>=0;i--){
    const next=Array.from({length:coefficients.length+1},()=>zero);
    coefficients.forEach((c,j)=>{next[j]=next[j]!.add(c.mul(X));next[j+1]=next[j+1]!.sub(c);});
    next[0]=next[0]!.add(new Polynomial([q.coefficients[i]!]));coefficients=next;
  }
  return resultantInParameter(p.coefficients.map(c=>new Polynomial([c])),coefficients);
}
/** A nonzero polynomial vanishing at a*b, eliminating T from p(T), T^n*q(X/T).
 * This cleared-denominator formula includes zero roots without dividing by T.
 */
export function productElimination(p:Polynomial,q:Polynomial):Polynomial {
  const coefficients=Array.from({length:q.degree+1},(_,j)=>{
    const i=q.degree-j;
    return new Polynomial([...Array<bigint>(i).fill(0n),q.coefficients[i]!]);
  });
  return resultantInParameter(p.coefficients.map(c=>new Polynomial([c])),coefficients);
}
