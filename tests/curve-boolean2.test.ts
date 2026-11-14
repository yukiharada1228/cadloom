import test from 'node:test';
import assert from 'node:assert/strict';
import {booleanCurveRegions2,booleanPolygons,preparePolygon,point2,segment2,circle2,fullCircleArc2,circularArc2,reverseCircularArc2,lineInterval2,line2,compareAlgebraicPoints2,algebraicCoordinates2,isolateRealRoots,Polynomial,Rational} from '../dist/index.js';
import type {CurveBoundary2,CurveRegion2,CurveBooleanResult2,BooleanOperation,PolygonRegion,FillRule} from '../dist/index.js';
const ops:BooleanOperation[]=['union','intersection','difference','xor'];
const truth=(a:boolean,b:boolean,op:BooleanOperation)=>op==='union'?a||b:op==='intersection'?a&&b:op==='difference'?a&&!b:a!==b;
const disk=(x:bigint|string,y:bigint|string,r:bigint|string,reverse=false):CurveRegion2=>[[{kind:'arc',arc:fullCircleArc2(circle2(point2(x,y),r),reverse?'cw':'ccw')}]];
const seg=(x:bigint|string,y:bigint|string,X:bigint|string,Y:bigint|string):CurveBoundary2=>({kind:'segment',segment:segment2(point2(x,y),point2(X,Y))});
const convert=(region:PolygonRegion):CurveRegion2=>region.map(r=>r.map((p,i)=>({kind:'segment',segment:segment2(p,r[(i+1)%r.length]!)})));
const box=(x:bigint,y:bigint,w:bigint,h=w):PolygonRegion=>[[point2(x,y),point2(x+w,y),point2(x+w,y+h),point2(x,y+h)]];
function verify(result:CurveBooleanResult2){
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.rings)&&Object.isFrozen(result.windings)&&result.windings.every(Object.isFrozen));
 const selected=new Set(result.selectedFaces);assert.ok(!selected.has(0));
 result.arrangement.faces.forEach((f,id)=>assert.equal(result.locate(f.sample),selected.has(id)?'inside':'outside'));
 let count=0;
 for(const ring of result.rings){
  assert.ok(ring.length>0&&Object.isFrozen(ring));
  ring.forEach((c,i)=>{
   assert.ok(Object.isFrozen(c));const a=c.kind==='segment'?c.segment:c.kind==='line'?c.interval:c.arc;
   const n=ring[(i+1)%ring.length]!,b=n.kind==='segment'?n.segment:n.kind==='line'?n.interval:n.arc;
   assert.equal(compareAlgebraicPoints2(algebraicCoordinates2(a.end.x,a.end.y),algebraicCoordinates2(b.start.x,b.start.y)),0);count++;
  });
 }
 const expected=result.arrangement.edges.filter((_,i)=>selected.has(result.arrangement.halfEdgeFaces[2*i]!)!==selected.has(result.arrangement.halfEdgeFaces[2*i+1]!)).length;
 assert.equal(count,expected);return result;
}
test('all circular Booleans agree with independent integer squared-distance truth tables',()=>{
 // Coordinates are quarter-integers; center/radius data below are scaled by 4/16.
 for(const [cx,cy,rr] of [[4n,0n,16n],[0n,0n,4n],[12n,0n,16n],[8n,0n,16n],[2n,0n,4n],[0n,4n,16n],[0n,0n,16n]]){
  const a=disk(0n,0n,1n),b=disk(new Rational(cx,4n).toString(),new Rational(cy,4n).toString(),new Rational(rr,16n).toString());
  for(const op of ops){
   const r=verify(booleanCurveRegions2(a,b,op));
   for(let x=-6n;x<=14n;x+=2n)for(let y=-6n;y<=6n;y+=2n){
    const s=x*x+y*y-16n,t=(x-cx)**2n+(y-cy)**2n-rr;
    if(s===0n||t===0n)continue;
    assert.equal(r.locate(point2(new Rational(x,4n),new Rational(y,4n))),truth(s<0n,t<0n,op)?'inside':'outside',`${cx},${cy},${rr}: ${op} @ ${x},${y}`);
   }
  }
 }
});
test('coincident rings preserve multiplicity and signed traversal under both fill rules',()=>{
 const c=disk(0n,0n,1n),reverse=disk(0n,0n,1n,true),center=point2(0n,0n),rim=point2(1n,0n);
 for(const rule of ['even-odd','nonzero'] as const){
  const twice=verify(booleanCurveRegions2([...c,...c],[],'union',rule));
  assert.equal(twice.locate(center),rule==='nonzero'?'inside':'outside');assert.equal(twice.locate(rim),rule==='nonzero'?'boundary':'outside');
  assert.equal(twice.windings.some(w=>w[0]===2n),true);
  const canceled=verify(booleanCurveRegions2([...c,...reverse],[],'union',rule));assert.equal(canceled.rings.length,0);assert.equal(canceled.locate(rim),'outside');
  const nested=verify(booleanCurveRegions2([...disk(0n,0n,4n),...c],[],'union',rule));
  assert.equal(nested.locate(center),rule==='nonzero'?'inside':'outside');assert.equal(nested.locate(rim),rule==='nonzero'?'inside':'boundary');
 }
 const hole=verify(booleanCurveRegions2([...disk(0n,0n,4n),...reverse],[],'union','nonzero'));assert.equal(hole.locate(center),'outside');assert.equal(hole.locate(point2('3/2',0n)),'inside');
});
test('semicircle shared trims, tangent contacts and zero-area walks are regularized',()=>{
 const c=circle2(point2(0n,0n),1n),east=point2(1n,0n),west=point2(-1n,0n);
 const upper:CurveRegion2=[[{kind:'arc',arc:circularArc2(c,east,west)},seg(-1n,0n,1n,0n)]];
 const lower:CurveRegion2=[[{kind:'arc',arc:circularArc2(c,west,east)},seg(1n,0n,-1n,0n)]];
 const union=verify(booleanCurveRegions2(upper,lower,'union'));assert.equal(union.rings.length,1);assert.equal(union.locate(point2(0n,0n)),'inside');assert.ok(union.rings.flat().every(c=>c.kind==='arc'));
 const common=verify(booleanCurveRegions2(upper,lower,'intersection'));assert.equal(common.rings.length,0);assert.equal(common.locate(point2(0n,0n)),'outside');
 const tangent=verify(booleanCurveRegions2(disk(0n,0n,1n),disk(2n,0n,1n),'intersection'));assert.equal(tangent.rings.length,0);assert.equal(tangent.locate(east),'outside');
 const joined=verify(booleanCurveRegions2(disk(0n,0n,1n),disk(2n,0n,1n),'union'));assert.equal(joined.rings.length,2);assert.equal(joined.locate(east),'boundary');
 const arc=circularArc2(c,east,west),zero:CurveRegion2=[[{kind:'arc',arc},{kind:'arc',arc:reverseCircularArc2(arc)}],[seg(0n,0n,2n,0n),seg(2n,0n,0n,0n)]];
 const empty=verify(booleanCurveRegions2(zero,[],'union'));assert.equal(empty.rings.length,0);assert.equal(empty.locate(point2(0n,1n)),'outside');
});
test('algebraically trimmed Boolean results compose exactly as new operands',()=>{
 const a=disk(0n,0n,1n),b=disk(1n,0n,1n),intersection=verify(booleanCurveRegions2(a,b,'intersection'));
 assert.ok(intersection.rings.flat().some(c=>c.kind==='arc'&&c.arc.start.y.rational===null));
 const remainder=verify(booleanCurveRegions2(a,intersection.rings,'difference'));
 const direct=verify(booleanCurveRegions2(a,b,'difference'));
 const restored=verify(booleanCurveRegions2(remainder.rings,intersection.rings,'union','nonzero'));
 const canceled=verify(booleanCurveRegions2(intersection.rings,intersection.rings,'xor'));assert.equal(canceled.rings.length,0);
 for(let x=-5n;x<=9n;x++)for(let y=-5n;y<=5n;y++){
  const p=point2(new Rational(x,4n),new Rational(y,4n));assert.equal(remainder.locate(p),direct.locate(p));
  const norm=x*x+y*y;assert.equal(restored.locate(p),norm<16n?'inside':norm===16n?'boundary':'outside');
 }
 const root=isolateRealRoots(new Polynomial(['-3/4',0n,1n]))[1]!;
 assert.equal(intersection.locate(algebraicCoordinates2('1/2',root)),'boundary');
 // Mixed line/circle clipping returns algebraic line trims that can be fed back.
 const clipped=verify(booleanCurveRegions2(a,convert(box(0n,-2n,2n,4n)),'intersection'));
 assert.equal(clipped.locate(point2(0n,0n)),'boundary');assert.equal(clipped.locate(point2('1/2',0n)),'inside');
 const again=verify(booleanCurveRegions2(clipped.rings,[],'union'));assert.equal(again.locate(point2(0n,0n)),'boundary');
 const capBox:PolygonRegion=[[point2(-2n,'1/2'),point2(2n,'1/2'),point2(2n,2n),point2(-2n,2n)]];
 const cap=verify(booleanCurveRegions2(a,convert(capBox),'intersection'));
 assert.ok(cap.rings.flat().some(c=>c.kind==='line'&&c.interval.start.x.rational===null));
 const recapped=verify(booleanCurveRegions2(cap.rings,[],'union'));
 assert.equal(recapped.locate(point2(0n,'1/2')),'boundary');assert.equal(recapped.locate(point2(0n,'3/4')),'inside');
 const pinched=verify(booleanCurveRegions2(disk(0n,0n,1n),disk('1/2',0n,'1/4'),'difference'));
 const repinched=verify(booleanCurveRegions2(pinched.rings,[],'union','nonzero'));
 assert.equal(repinched.locate(point2(1n,0n)),'boundary');assert.equal(repinched.locate(point2('-1/2',0n)),'inside');assert.equal(repinched.locate(point2('1/2',0n)),'outside');
});
test('straight closed walks agree with the independent polygon boundary locator',()=>{
 let seed=91821;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%7)-3n;};
 for(let trial=0;trial<12;trial++){
  const a:PolygonRegion=[Array.from({length:5},()=>point2(next(),next()))],b=box(next(),next(),2n);
  const rule:FillRule=trial%2?'nonzero':'even-odd';
  for(const op of ops){
   const result=verify(booleanCurveRegions2(convert(a),convert(b),op,rule)),old=booleanPolygons(a,b,op,rule),oracle=preparePolygon(old.rings,'nonzero');
   for(let x=-4n;x<=4n;x++)for(let y=-4n;y<=4n;y++){
    const p=point2(new Rational(x,2n),new Rational(y,2n));assert.equal(result.locate(p),oracle.locate(p),`${trial} ${op} @ ${x},${y}`);
   }
  }
 }
});
test('closed-walk validation, empty operands and caller snapshots',()=>{
 assert.equal(verify(booleanCurveRegions2([],[],'union')).rings.length,0);
 assert.throws(()=>booleanCurveRegions2([[]],[],'union'),RangeError);
 assert.throws(()=>booleanCurveRegions2([[seg(0n,0n,1n,0n)]],[],'union'),RangeError);
 assert.throws(()=>booleanCurveRegions2([],[],'bad' as BooleanOperation),RangeError);
 assert.throws(()=>booleanCurveRegions2([],[],'union','bad' as FillRule),RangeError);
 const line=line2(point2(0n,0n),point2(1n,0n));
 const retrace:CurveRegion2=[[{kind:'line',interval:lineInterval2(line,0n,1n)},{kind:'line',interval:lineInterval2(line,1n,0n)}]];
 assert.equal(verify(booleanCurveRegions2(retrace,[],'union')).rings.length,0);
 const source=[...disk(0n,0n,1n).map(r=>[...r])],result=verify(booleanCurveRegions2(source,[],'union'));source[0]!.length=0;
 assert.equal(result.locate(point2(0n,0n)),'inside');
 // Closure is checked at the caller's full-circle seam before noding canonicalizes it.
 const west=point2(-1n,0n),full=circularArc2(circle2(point2(0n,0n),1n),west,west,{fullCircle:true});
 const customSeam=verify(booleanCurveRegions2([[{kind:'arc',arc:full},seg(-1n,0n,1n,0n),seg(1n,0n,-1n,0n)]],[],'union'));
 assert.equal(customSeam.locate(point2(0n,0n)),'inside');assert.equal(customSeam.locate(west),'boundary');
});
test('seeded mixed circle/rectangle face windings agree with independent containment sums',()=>{
 let seed=56283;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let trial=0;trial<20;trial++){
  const operands:[CurveBoundary2[][],CurveBoundary2[][]]=[[],[]];
  const shapes:{owner:0|1;sign:bigint;contains:(p:ReturnType<typeof point2>)=>boolean}[]=[];
  for(let i=0;i<5;i++){
   const owner=(i%2) as 0|1,x=BigInt(next()%7)-3n,y=BigInt(next()%7)-3n,sign=next()%2?1n:-1n;
   if(i<3){
    const r=BigInt(next()%3)+1n,ring=[...disk(x,y,r)[0]!];
    if(sign<0n)ring[0]={kind:'arc',arc:reverseCircularArc2((ring[0] as Extract<CurveBoundary2,{kind:'arc'}>).arc)};
    operands[owner].push(ring);shapes.push({owner,sign,contains:p=>{const dx=p.x.sub(new Rational(x)),dy=p.y.sub(new Rational(y));return dx.mul(dx).add(dy.mul(dy)).compare(new Rational(r))<0;}});
   }else{
    const w=BigInt(next()%3)+1n,h=BigInt(next()%3)+1n,polygon=box(x,y,w,h);
    operands[owner].push([...convert(sign>0n?polygon:[polygon[0]!.slice().reverse()])[0]!]);
    shapes.push({owner,sign,contains:p=>p.x.compare(new Rational(x))>0&&p.x.compare(new Rational(x+w))<0&&p.y.compare(new Rational(y))>0&&p.y.compare(new Rational(y+h))<0});
   }
  }
  for(const rule of ['even-odd','nonzero'] as const){
   const op=ops[trial%4]!,result=verify(booleanCurveRegions2(operands[0],operands[1],op,rule));
   result.arrangement.faces.forEach((face,id)=>{
    const expected:[bigint,bigint]=[0n,0n];for(const shape of shapes)if(shape.contains(face.sample))expected[shape.owner]+=shape.sign;
    assert.deepEqual(result.windings[id],expected,`trial ${trial}, face ${id}`);
    const inside=(n:bigint)=>rule==='nonzero'?n!==0n:n%2n!==0n;
    assert.equal(result.locate(face.sample),truth(inside(expected[0]),inside(expected[1]),op)?'inside':'outside');
   });
  }
 }
});
test('thin curved material and tiny tangent gaps remain distinct without tolerances',()=>{
 const one=new Rational(1n),epsilon=Rational.parse('1/1'+'0'.repeat(30)),inner=one.sub(epsilon);
 const annulus=verify(booleanCurveRegions2(disk(0n,0n,1n),disk(0n,0n,inner.mul(inner).toString()),'difference'));
 const midpoint=point2(one.sub(epsilon.div(new Rational(2n))),0n);
 assert.equal(annulus.locate(midpoint),'inside');assert.equal(annulus.locate(point2(0n,0n)),'outside');
 assert.equal(verify(booleanCurveRegions2(annulus.rings,[],'union')).locate(midpoint),'inside');
 const center=new Rational(2n).sub(epsilon),lens=verify(booleanCurveRegions2(disk(0n,0n,1n),disk(center.toString(),0n,1n),'intersection'));
 assert.equal(lens.locate(point2(center.div(new Rational(2n)),0n)),'inside');assert.equal(lens.locate(point2(1n,0n)),'boundary');
 const gap=verify(booleanCurveRegions2(disk(0n,0n,1n),disk(new Rational(2n).add(epsilon).toString(),0n,1n),'intersection'));assert.equal(gap.rings.length,0);
});
