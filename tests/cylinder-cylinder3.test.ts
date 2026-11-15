import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point3,line3,cylinder3,intersectCylinders3,evaluateCylinderIntersectionArc3,pointOnCylinderIntersectionArc3,pointOnArc3,classifyPointToSurface3,algebraicLineOnSurface3,compareAlgebraicPoints3,AlgebraicReal,algebraicCoordinates3,pointOnCircle3,circle3,plane3,interiorPointOnArc3} from '../dist/index.js';
import {algebraicBiparametricPoint3,snapshotExactPoint3} from '../dist/geometry/algebraic-point3.js';
import {evaluateCylinderIntersectionFiber3} from '../dist/geometry/cylinder-cylinder3.js';
import {evaluatePlaneAtAlgebraicPoint3} from '../dist/geometry/algebraic-segment-plane3.js';
import type {Cylinder3,CylinderCylinderIntersection3,AlgebraicCoordinates3} from '../dist/index.js';
const O=point3(0n,0n),Z=point3(0n,0n,1n),X=point3(1n,0n,0n),A=cylinder3(line3(O,Z),1n),B=cylinder3(line3(O,X),1n);
function bounded(r:CylinderCylinderIntersection3){assert.equal(r.kind,'bounded');if(r.kind!=='bounded')throw new Error('Expected finite SSI graph');return r;}
function check(r:CylinderCylinderIntersection3,a:Cylinder3,b:Cylinder3){
 const g=bounded(r);assert.equal(g.arcs.length,g.edges.length);assert.equal(g.vertices.length,g.ports.length);
 for(const p of [...g.vertices,...g.arcs.map(a=>a.sample)]){assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:a}),0);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:b}),0);}
 g.edges.forEach((edge,i)=>{assert.equal(edge.arc,i);assert.equal(compareAlgebraicPoints3(g.vertices[edge.start]!,g.arcs[i]!.start),0);assert.equal(compareAlgebraicPoints3(g.vertices[edge.end]!,g.arcs[i]!.end),0);assert.ok(g.ports[edge.start]!.includes(2*i)&&g.ports[edge.end]!.includes(2*i+1));});
 g.arcs.forEach(arc=>{assert.equal(pointOnCylinderIntersectionArc3(arc.start,arc),true);assert.equal(pointOnCylinderIntersectionArc3(arc.end,arc),true);assert.equal(pointOnCylinderIntersectionArc3(arc.sample,arc),true);assert.equal(compareAlgebraicPoints3(evaluateCylinderIntersectionArc3(arc,arc.baseSample),arc.sample),0);});
 assert.equal(g.components.reduce((n,c)=>n+c.edges.length,0),g.edges.length);assert.equal(g.components.reduce((n,c)=>n+c.vertices.length,0),g.vertices.length);
 assert.ok(g.ports.every(p=>p.length===0||p.length===2||p.length===4));assert.ok(Object.isFrozen(g)&&Object.isFrozen(g.arcs)&&Object.isFrozen(g.vertices)&&g.ports.every(Object.isFrozen));return g;
}
function unique(points:readonly AlgebraicCoordinates3[]){return points.filter((p,i)=>points.findIndex(q=>compareAlgebraicPoints3(p,q)===0)===i);}
test('parallel surfaces distinguish coincidence, disjointness and one/two complete common generators',()=>{
 assert.equal(intersectCylinders3(A,cylinder3(line3(point3(0n,0n,5n),point3(0n,0n,-3n)),1n)).kind,'coincident');
 assert.equal(intersectCylinders3(A,cylinder3(line3(O,Z),2n)).kind,'none');
 assert.equal(intersectCylinders3(A,cylinder3(line3(point3(3n,0n),Z),1n)).kind,'none');
 for(const [offset,count,multiplicity] of [[1n,2,1],[2n,1,2]] as const){const c=cylinder3(line3(point3(offset,0n,7n),point3(0n,0n,-2n)),1n),r=intersectCylinders3(A,c);assert.equal(r.kind,'lines');if(r.kind!=='lines')continue;
  assert.equal(r.lines.length,count);for(const item of r.lines){assert.equal(item.multiplicity,multiplicity);assert.equal(algebraicLineOnSurface3(item.line,{kind:'cylinder',cylinder:A}),true);assert.equal(algebraicLineOnSurface3(item.line,{kind:'cylinder',cylinder:c}),true);}
 }
 const d=point3(1n,2n,2n),a=cylinder3(line3(point3(3n,-2n,7n),d),5n),b=cylinder3(line3(point3(5n,-3n,7n),d),5n),r=intersectCylinders3(a,b);assert.equal(r.kind,'lines');if(r.kind==='lines')r.lines.forEach(({line})=>{assert.equal(algebraicLineOnSurface3(line,{kind:'cylinder',cylinder:a}),true);assert.equal(algebraicLineOnSurface3(line,{kind:'cylinder',cylinder:b}),true);});
});
test('equal perpendicular cylinders form two crossing elliptic loci with two exact valence-four nodes',()=>{
 const g=check(intersectCylinders3(A,B),A,B);assert.equal(g.singularVertices.length,2);assert.equal(g.components.length,1);assert.equal(g.isolatedPoints.length,0);
 for(const id of g.singularVertices){const p=g.vertices[id]!;assert.equal(p.x.sign(),0);assert.equal(p.z.sign(),0);assert.equal(p.y.mul(p.y).compare(AlgebraicReal.fromRational(1n)),0);}
 // Independent Pythagorean parameter enumeration: z = +/- x, x²+y²=1.
 for(let n=1n;n<=3n;n++)for(let m=-3n;m<=3n;m++){
  const den=n*n+m*m,x=new Rational(n*n-m*m,den),y=new Rational(2n*m*n,den),q=point3(x,y),hits=unique(g.arcs.filter(a=>pointOnArc3(q,a.base)).map(a=>evaluateCylinderIntersectionArc3(a,q)));
  const expected=unique([algebraicCoordinates3(x,y,x),algebraicCoordinates3(x,y,x.neg())]);assert.equal(hits.length,expected.length);
  for(const p of expected)assert.ok(hits.some(q=>compareAlgebraicPoints3(p,q)===0));
  for(const arc of g.arcs)for(const p of expected){const sign=p.z.sign(),inside=pointOnArc3(q,arc.base)&&(sign===0||sign===arc.branch);assert.equal(pointOnCylinderIntersectionArc3(p,arc),inside);}
 }
});
test('unequal centered perpendicular cylinders yield two disjoint closed branches with independent square-root heights',()=>{
 const b=cylinder3(line3(O,X),4n),g=check(intersectCylinders3(A,b),A,b);assert.equal(g.components.length,2);assert.equal(g.singularVertices.length,0);assert.equal(g.isolatedPoints.length,0);assert.ok(g.ports.every(p=>p.length===2));
 const q=point3('3/5','4/5'),hits=g.arcs.filter(a=>pointOnArc3(q,a.base)).map(a=>evaluateCylinderIntersectionArc3(a,q));assert.equal(hits.length,2);
 for(const p of hits){assert.equal(p.x.compare(AlgebraicReal.fromRational('3/5')),0);assert.equal(p.y.compare(AlgebraicReal.fromRational('4/5')),0);assert.equal(p.z.mul(p.z).compare(AlgebraicReal.fromRational('84/25')),0);}
});
test('external skew tangency is an isolated point, while a strip tangency inside the locus is a singular node',()=>{
 const tangent=cylinder3(line3(point3(0n,2n),X),1n),g=check(intersectCylinders3(A,tangent),A,tangent);assert.equal(g.arcs.length,0);assert.equal(g.isolatedPoints.length,1);assert.equal(compareAlgebraicPoints3(g.isolatedPoints[0]!,algebraicCoordinates3(0n,1n,0n)),0);assert.equal(g.components.length,1);assert.equal(g.ports[0]!.length,0);
 assert.equal(intersectCylinders3(A,cylinder3(line3(point3(0n,3n),X),1n)).kind,'none');
 const larger=cylinder3(line3(O,Z),4n),other=cylinder3(line3(point3(0n,1n),X),1n),node=check(intersectCylinders3(larger,other),larger,other);assert.equal(node.singularVertices.length,1);assert.equal(node.isolatedPoints.length,0);assert.equal(compareAlgebraicPoints3(node.vertices[node.singularVertices[0]!]!,algebraicCoordinates3(0n,2n,0n)),0);
});
test('general offset skew rational axes produce complete real algebraic graph branches on both supports',()=>{
 const a=cylinder3(line3(O,Z),2n),b=cylinder3(line3(point3('1/3','2/5','1/7'),point3(1n,1n,1n)),1n),g=check(intersectCylinders3(a,b),a,b);
 assert.equal(g.components.length,2);assert.equal(g.singularVertices.length,0);assert.equal(g.isolatedPoints.length,0);assert.ok(g.arcs.length>=4);
 for(const arc of g.arcs){const q=interiorPointOnArc3(arc.base),p=evaluateCylinderIntersectionArc3(arc,q);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:a}),0);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:b}),0);assert.equal(pointOnCylinderIntersectionArc3(p,arc),true);}
 const reverse=bounded(intersectCylinders3(b,a));for(const p of g.vertices.slice(0,2))assert.ok(reverse.arcs.some(arc=>pointOnCylinderIntersectionArc3(p,arc)));
});
test('axis rescaling/translation leaves geometry unchanged and microscopic near-tangency is not rounded',()=>{
 const shiftedA=cylinder3(line3(point3(0n,0n,7n),point3(0n,0n,-3n)),1n),shiftedB=cylinder3(line3(point3(5n,0n),point3(7n,0n,0n)),1n),g=check(intersectCylinders3(shiftedA,shiftedB),shiftedA,shiftedB);assert.equal(g.singularVertices.length,2);assert.equal(g.components.length,1);
 const tiny=new Rational(1n,10n**20n),outside=cylinder3(line3(point3(0n,new Rational(2n).add(tiny)),X),1n);assert.equal(intersectCylinders3(A,outside).kind,'none');
 const inside=cylinder3(line3(point3(0n,new Rational(2n).sub(tiny)),X),1n),thin=check(intersectCylinders3(A,inside),A,inside);assert.ok(thin.arcs.length>0);assert.equal(thin.isolatedPoints.length,0);
});
test('biparametric points expand exact linear/quadratic predicates without trusting forged chart metadata',()=>{
 const s=AlgebraicReal.fromRational(2n).sqrt(),t=AlgebraicReal.fromRational(3n).sqrt(),p=algebraicBiparametricPoint3(O,X,s,point3(1n,1n),t);
 assert.equal(snapshotExactPoint3(p),p);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:cylinder3(line3(O,Z),13n)}),-1);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:cylinder3(line3(O,Z),12n)}),1);
 assert.equal(evaluatePlaneAtAlgebraicPoint3(plane3(1n,-1n,0n,-1n),p).sign(),1);assert.equal(evaluatePlaneAtAlgebraicPoint3(plane3(1n,-1n,0n,-2n),p).sign(),-1);
 const orthogonal=algebraicBiparametricPoint3(O,X,s,point3(0n,1n),t);assert.equal(pointOnCircle3(orthogonal,circle3(O,Z,5n)),true);assert.equal(classifyPointToSurface3(orthogonal,{kind:'cylinder',cylinder:cylinder3(line3(O,Z),5n)}),0);
 const fake={...p,x:AlgebraicReal.fromRational(0n),origin:O,u:X,s,v:point3(1n,1n),t};assert.equal(classifyPointToSurface3(fake,{kind:'cylinder',cylinder:cylinder3(line3(O,Z),5n)}),-1);assert.ok(Object.isFrozen(p));
});
test('owned arc evaluation rejects off-domain points, forged arc objects and invalid cylinders',()=>{
 const g=bounded(intersectCylinders3(A,B)),arc=g.arcs[0]!;
 assert.throws(()=>evaluateCylinderIntersectionArc3({...arc},arc.baseSample),RangeError);assert.throws(()=>pointOnCylinderIntersectionArc3(arc.sample,{...arc}),RangeError);
 assert.throws(()=>evaluateCylinderIntersectionArc3(arc,point3(0n,0n)),RangeError);assert.equal(pointOnCylinderIntersectionArc3(point3(0n,0n),arc),false);
 assert.throws(()=>intersectCylinders3({...A,radiusSquared:new Rational(0n)},B),RangeError);
});

test('nearly parallel nonparallel axes keep finite short and very long branches exactly',()=>{
 const tiny=new Rational(1n,10n**12n),b=cylinder3(line3(O,point3(tiny,0n,1n)),1n),g=check(intersectCylinders3(A,b),A,b);
 assert.equal(g.singularVertices.length,2);assert.equal(g.components.length,1);
 assert.ok(g.arcs.some(a=>a.sample.z.compare(AlgebraicReal.fromRational(10n**10n))>0));
 assert.ok(g.arcs.some(a=>a.sample.z.sign()!==0&&a.sample.z.compare(AlgebraicReal.fromRational('1/1000000'))<0&&a.sample.z.sign()>0));
});

 test('fiber recovery reuses owned endpoint and sample roots only after validating both supports',()=>{
 const g=bounded(intersectCylinders3(A,cylinder3(line3(O,X),4n)));
 for(const arc of g.arcs)for(const [q,expected] of [[arc.base.start,arc.start],[arc.base.end,arc.end],[arc.baseSample,arc.sample]] as const){
  const other=g.arcs.find(a=>a.branch!==arc.branch&&pointOnArc3(q,a.base));assert.ok(other);
  const opposite=evaluateCylinderIntersectionArc3(other,q);
  assert.equal(evaluateCylinderIntersectionFiber3(arc,q,opposite),expected);
  assert.equal(evaluateCylinderIntersectionFiber3(arc,q,algebraicCoordinates3(q.x,q.y,0n)),undefined);
 }
 const arc=g.arcs[0]!;assert.throws(()=>evaluateCylinderIntersectionFiber3({...arc},arc.baseSample,arc.sample),RangeError);
 });
