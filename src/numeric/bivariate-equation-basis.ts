import {BivariatePolynomial} from './bivariate-polynomial.js';
import {Rational} from './rational.js';
/** Internal canonical rational row-space basis. Only invertible row operations
 * and removal of identically zero rows are used, preserving simultaneous
 * zeros, including shared curves. Spatial affine mixing of homogeneous curve
 * equations therefore has the same basis before polynomial elimination. */
export function bivariateEquationBasis(input:readonly BivariatePolynomial[]):readonly BivariatePolynomial[] {
 const u=Math.max(-1,...input.map(p=>p.degreeU)),v=Math.max(-1,...input.map(p=>p.degreeV));
 if(u<0||v<0)return Object.freeze([]);
 const zero=new Rational(0n),indices=Array.from({length:u+1},(_,i)=>Array.from({length:v+1},(_,j)=>[i,j] as const)).flat();
 const complexity=(p:BivariatePolynomial)=>[p.degreeU===0&&p.degreeV===0?0:p.degreeU===0||p.degreeV===0?1:2,p.degreeU+p.degreeV,p.rows.reduce((n,r)=>n+r.coefficients.filter(c=>c.sign()!==0).length,0)];
 const compare=(a:readonly number[],b:readonly number[])=>{for(let i=0;i<a.length;i++){const d=a[i]!-b[i]!;if(d)return d;}return 0;};
 const basis=(first:'u'|'v')=>{
 const monomials=[...indices].sort((a,b)=>first==='u'?b[0]-a[0]||b[1]-a[1]:b[1]-a[1]||b[0]-a[0]),columns=monomials.length,rows=input.map(p=>monomials.map(([i,j])=>p.coefficient(i,j)));let rank=0;
 for(let column=0;column<columns&&rank<rows.length;column++){
  const pivot=rows.findIndex((row,i)=>i>=rank&&row[column]!.sign()!==0);if(pivot<0)continue;
  [rows[rank],rows[pivot]]=[rows[pivot]!,rows[rank]!];const divisor=rows[rank]![column]!;rows[rank]=rows[rank]!.map(q=>q.div(divisor));
  for(let i=0;i<rows.length;i++)if(i!==rank){const factor=rows[i]![column]!;if(factor.sign()!==0)rows[i]=rows[i]!.map((q,j)=>q.sub(factor.mul(rows[rank]![j]!)));}
  rank++;
 }
 return rows.slice(0,rank).map(row=>{const coefficients=Array.from({length:u+1},()=>Array.from({length:v+1},()=>zero));monomials.forEach(([i,j],k)=>{coefficients[i]![j]=row[k]!;});return new BivariatePolynomial(coefficients);}).sort((a,b)=>compare(complexity(a),complexity(b)));
 };
 // Each lexicographic RREF is unique for its row space. Prefer a basis that
 // exposes univariate constraints instead of hiding them in mixed equations.
 const a=basis('u'),b=basis('v'),score=(ps:readonly BivariatePolynomial[])=>[ps.filter(p=>p.degreeU>0&&p.degreeV>0).length,ps.reduce((s,p)=>s+p.degreeU+p.degreeV,0),ps.reduce((s,p)=>s+complexity(p)[2]!,0)];
 return Object.freeze(compare(score(a),score(b))<=0?a:b);
}
