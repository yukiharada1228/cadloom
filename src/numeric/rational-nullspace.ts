import {Rational} from './rational.js';
/** Internal exact RREF; callers independently verify discovered identities. */
export function rationalNullspace(input:readonly (readonly Rational[])[],columns:number):Rational[][] {
 if(!Number.isSafeInteger(columns)||columns<1||input.some(r=>r.length!==columns))throw new RangeError('Invalid rational constraint dimensions');
 const zero=new Rational(0n),one=new Rational(1n),rows=input.map(row=>[...row]),pivots:number[]=[];let r=0;
 for(let col=0;col<columns&&r<rows.length;col++){
  const at=rows.findIndex((row,i)=>i>=r&&row[col]!.sign()!==0);if(at<0)continue;[rows[r],rows[at]]=[rows[at]!,rows[r]!];const divisor=rows[r]![col]!;rows[r]=rows[r]!.map(x=>x.div(divisor));
  for(let i=0;i<rows.length;i++)if(i!==r){const factor=rows[i]![col]!;if(factor.sign()!==0)rows[i]=rows[i]!.map((x,j)=>x.sub(factor.mul(rows[r]![j]!)));}
  pivots.push(col);r++;
 }
 const result:Rational[][]=[];for(let free=0;free<columns;free++)if(!pivots.includes(free)){const vector=Array.from({length:columns},()=>zero);vector[free]=one;pivots.forEach((pivot,i)=>{vector[pivot]=rows[i]![free]!.neg();});result.push(vector);}return result;
}
