import test from 'node:test';
import assert from 'node:assert/strict';
import {booleanPolygons,point2,Rational} from '../dist/index.js';
import type {PolygonRegion,BooleanOperation,Point2} from '../dist/index.js';
const p=(x:number,y:number)=>point2(BigInt(x),BigInt(y));
const box=(x:number,y:number,w:number,h=w)=>[p(x,y),p(x+w,y),p(x+w,y+h),p(x,y+h)];
const ops: BooleanOperation[]=['union','intersection','difference','xor'];
const area=(r:PolygonRegion)=>r.reduce((sum,ring)=>ring.reduce((sum,p,i)=>{
 const q=ring[(i+1)%ring.length]!;return sum.add(p.x.mul(q.y).sub(p.y.mul(q.x)));
},sum),new Rational(0n));
function check(a:PolygonRegion,b:PolygonRegion,op:BooleanOperation,expected:string,rule:'even-odd'|'nonzero'='even-odd') {
 const r=booleanPolygons(a,b,op,rule);
 assert.equal(r.twiceArea.toString(),expected);
 assert.ok(area(r.rings).equals(r.twiceArea));
 assert.ok(Object.isFrozen(r.rings));
 assert.ok(r.rings.every(ring=>Object.isFrozen(ring)&&ring.every(Object.isFrozen)));
 return r;
}
test('overlapping squares, empty operands and idempotence',()=>{
 const a=[box(0,0,2)], b=[box(1,1,2)];
 ops.forEach((op,i)=>check(a,b,op,['14','2','6','12'][i]!));
 check(a,[],'union','8');check([],a,'intersection','0');check([],a,'difference','0');
 check(a,a,'union','8');check(a,a,'intersection','8');check(a,a,'difference','0');check(a,a,'xor','0');
 assert.throws(()=>booleanPolygons([[p(0,0)]],[],'union'),RangeError);
});
test('holes, duplicate rings, nonzero winding and orientation',()=>{
 const outer=box(0,0,4), hole=box(1,1,2);
 check([outer,hole],[],'union','24');
 check([outer,hole],[],'union','32','nonzero');
 check([outer,hole.slice().reverse()],[],'union','24','nonzero');
 check([outer,outer],[],'union','0');
 check([outer,outer],[],'union','32','nonzero');
 const r=check([outer],[hole],'difference','24');assert.equal(r.rings.length,2);
 check(r.rings,[hole],'union','32','nonzero');
});
test('shared edges, point contacts, zero area and self intersections are regularized',()=>{
 const a=[box(0,0,1)];
 assert.equal(check(a,[box(1,0,1)],'intersection','0').rings.length,0);
 assert.equal(check(a,[box(1,1,1)],'intersection','0').rings.length,0);
 assert.equal(check(a,[box(1,0,1)],'union','4').rings.length,1);
 assert.equal(check(a,[box(1,1,1)],'union','4').rings.length,2);
 check([[p(0,0),p(1,0),p(2,0)]],[],'union','0');
 check([[p(0,0),p(2,2),p(0,2),p(2,0)]],[],'union','4');
});
// Independent rectangle oracle uses interval overlap, not the arrangement implementation.
test('exhaustive integer rectangles agree with interval-area oracle',()=>{
 for(let x=-1;x<=2;x++)for(let y=-1;y<=2;y++)for(let w=1;w<=3;w++)for(let h=1;h<=3;h++){
  const a=[box(0,0,2)],b=[box(x,y,w,h)];
  const overlap=Math.max(0,Math.min(2,x+w)-Math.max(0,x))*Math.max(0,Math.min(2,y+h)-Math.max(0,y));
  const aa=4,bb=w*h;
  ops.forEach((op,i)=>check(a,b,op,String(2*[aa+bb-overlap,overlap,aa-overlap,aa+bb-2*overlap][i]!)));
 }
});
// Independent horizontal-ray oracle: explicitly computes the x intersection.
function membership(region:PolygonRegion,p:Point2,rule:'even-odd'|'nonzero'):boolean|null {
 let winding=0;
 for(const ring of region)for(let i=0;i<ring.length;i++){
  const a=ring[i]!,b=ring[(i+1)%ring.length]!;
  const dx=b.x.sub(a.x),dy=b.y.sub(a.y);
  const cross=dx.mul(p.y.sub(a.y)).sub(dy.mul(p.x.sub(a.x)));
  const between=(v:Rational,a:Rational,b:Rational)=>v.compare(a)>=0&&v.compare(b)<=0||v.compare(b)>=0&&v.compare(a)<=0;
  if(cross.sign()===0&&between(p.x,a.x,b.x)&&between(p.y,a.y,b.y)) return null;
  if((a.y.compare(p.y)<=0&&b.y.compare(p.y)>0)||(b.y.compare(p.y)<=0&&a.y.compare(p.y)>0)){
   const hit=a.x.add(p.y.sub(a.y).mul(dx).div(dy));
   if(hit.compare(p.x)>0)winding+=dy.sign();
  }
 }
 return rule==='nonzero'?winding!==0:winding%2!==0;
}
test('seeded arbitrary/self-intersecting rings agree with independent point membership oracle',()=>{
 let seed=1234;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let fixture=0;fixture<35;fixture++){
  const ring=()=>Array.from({length:3+rand()%4},()=>p(rand()%5,rand()%5));
  const a=[ring(),ring()],b=[ring()];
  for(const rule of ['even-odd','nonzero'] as const)for(const op of ops){
   const r=booleanPolygons(a,b,op,rule);
   assert.ok(area(r.rings).equals(r.twiceArea));
   for(let x=-1;x<=5;x++)for(let y=-1;y<=5;y++){
    const q=point2(`${3*x+1}/3`,`${3*y+1}/3`);
    const u=membership(a,q,rule),v=membership(b,q,rule);
    if(u===null||v===null)continue;
    const expected=op==='union'?u||v:op==='intersection'?u&&v:op==='difference'?u&&!v:u!==v;
    assert.equal(membership(r.rings,q,'nonzero'),expected,`fixture ${fixture}, ${rule}, ${op}, ${x},${y}`);
   }
  }
 }
});
test('tiny rational scales, reflection and reversed input preserve Boolean areas',()=>{
 const a=[box(0,0,2)],b=[box(1,1,2)];
 const scale=Rational.parse('1/1000000000000000000000000000000000000000');
 const offset=Rational.parse('90071992547409931234567890123456789');
 const move=(r:PolygonRegion)=>r.map(ring=>ring.slice().reverse().map(p=>point2(p.x.mul(scale).neg().add(offset),p.y.mul(scale))));
 for(const op of ops){
  const original=booleanPolygons(a,b,op),moved=booleanPolygons(move(a),move(b),op);
  assert.ok(moved.twiceArea.div(scale.mul(scale)).equals(original.twiceArea));
  assert.ok(area(moved.rings).equals(moved.twiceArea));
 }
});
