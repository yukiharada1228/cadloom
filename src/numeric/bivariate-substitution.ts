import {BivariatePolynomial} from './bivariate-polynomial.js';
const one=new BivariatePolynomial([[1n]]);
/** W^totalDegree(F) F(A/W,B/W) in Q[u,v], with no division or approximation. */
export function homogeneousBivariateSubstitution(f:BivariatePolynomial,A:BivariatePolynomial,B:BivariatePolynomial,W:BivariatePolynomial):BivariatePolynomial {
 if(f.degreeU<0)return new BivariatePolynomial();const du=f.degreeU,dv=f.degreeV;let degree=0;f.rows.forEach((row,i)=>row.coefficients.forEach((c,j)=>{if(c.sign()!==0)degree=Math.max(degree,i+j);}));const powers=(p:BivariatePolynomial,n:number)=>{const r=[one];for(let i=1;i<=n;i++)r.push(r[i-1]!.mul(p));return r;},U=powers(A,du),V=powers(B,dv),D=powers(W,degree);let result=new BivariatePolynomial();f.rows.forEach((row,i)=>row.coefficients.forEach((c,j)=>{if(c.sign()!==0)result=result.add(U[i]!.mul(V[j]!).mul(D[degree-i-j]!).scale(c));}));return result;
}
