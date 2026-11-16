import {BivariatePolynomial} from './bivariate-polynomial.js';
import {divideBivariateExact} from './bivariate-system.js';
const zero=new BivariatePolynomial(),one=new BivariatePolynomial([[1n]]);
/** Internal resultant in Q[u,v], eliminating t from ascending t-coefficients.
 * Fraction-free Sylvester/Bareiss elimination with exact polynomial pivots. */
export function resultantOverBivariatePolynomials(first:readonly BivariatePolynomial[],second:readonly BivariatePolynomial[]):BivariatePolynomial {
 const p=[...first],q=[...second];while(p.length&&p[p.length-1]!.degreeU<0)p.pop();while(q.length&&q[q.length-1]!.degreeU<0)q.pop();if(!p.length||!q.length)return zero;
 const m=p.length-1,n=q.length-1,size=m+n;if(size===0)return one;
 const matrix=Array.from({length:size},()=>Array.from({length:size},()=>zero));for(let i=0;i<n;i++)for(let j=0;j<=m;j++)matrix[i]![i+j]=p[m-j]!;for(let i=0;i<m;i++)for(let j=0;j<=n;j++)matrix[n+i]![i+j]=q[n-j]!;
 let previous=one,sign=1n;
 for(let k=0;k<size-1;k++){
  let row=k;while(row<size&&matrix[row]![k]!.degreeU<0)row++;if(row===size)return zero;if(row!==k){[matrix[k],matrix[row]]=[matrix[row]!,matrix[k]!];sign=-sign;}
  const pivot=matrix[k]![k]!;for(let i=k+1;i<size;i++){for(let j=k+1;j<size;j++)matrix[i]![j]=divideBivariateExact(matrix[i]![j]!.mul(pivot).sub(matrix[i]![k]!.mul(matrix[k]![j]!)),previous);matrix[i]![k]=zero;}previous=pivot;
 }
 return matrix[size-1]![size-1]!.scale(sign);
}
