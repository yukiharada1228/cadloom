import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,Polynomial,AlgebraicReal,point3,line3,cylinder3,plane3,intersectCylinders3,intersectCylinderIntersectionArcPlane3,splitCylinderIntersectionArcByPlane3,clipCylinderIntersectionByHalfspaces3,pointOnCylinderIntersectionArc3,splitCylinderIntersectionArc3,evaluateCylinderIntersectionArc3,pointOnArc3,classifyPointToSurface3,compareAlgebraicPoints3,pointOnCircle3,circle3,algebraicCoordinates3} from '../dist/index.js';
import {algebraicRationalPoint3,snapshotExactPoint3} from '../dist/geometry/algebraic-point3.js';
import type {AlgebraicCoordinates3,BoundedCylinderIntersection3,Cylinder3,Plane3} from '../dist/index.js';
const O=point3(0n,0n),Z=point3(0n,0n,1n),X=point3(1n,0n,0n),A=cylinder3(line3(O,Z),1n),B=cylinder3(line3(O,X),1n);
function graph(a=A,b=B){const g=intersectCylinders3(a,b);assert.equal(g.kind,'bounded');if(g.kind!=='bounded')throw new Error('Expected bounded SSI');return g;}
const same=(p:AlgebraicCoordinates3,q:AlgebraicCoordinates3)=>compareAlgebraicPoints3(p,q)===0;
function unique(points:readonly AlgebraicCoordinates3[]){return points.filter((p,i)=>points.findIndex(q=>same(p,q))===i);}
function on(p:AlgebraicCoordinates3,g:BoundedCylinderIntersection3){return g.isolatedPoints.some(q=>same(p,q))||g.arcs.some(a=>pointOnCylinderIntersectionArc3(p,a));}
function planePoints(g:BoundedCylinderIntersection3,plane:Plane3){return unique(g.arcs.flatMap(a=>{const h=intersectCylinderIntersectionArcPlane3(a,plane);assert.notEqual(h.kind,'overlap');return h.kind==='points'?h.points:[];}));}
function check(g:BoundedCylinderIntersection3,a=A,b=B){
 for(const p of [...g.vertices,...g.arcs.map(a=>a.sample)]){assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:a}),0);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:b}),0);}
 assert.equal(g.edges.length,g.arcs.length);g.edges.forEach((e,i)=>{assert.ok(same(g.vertices[e.start]!,g.arcs[i]!.start));assert.ok(same(g.vertices[e.end]!,g.arcs[i]!.end));assert.ok(g.ports[e.start]!.includes(2*i)&&g.ports[e.end]!.includes(2*i+1));});
 assert.equal(g.components.reduce((n,c)=>n+c.edges.length,0),g.edges.length);assert.ok(Object.isFrozen(g)&&Object.isFrozen(g.arcs));
}
test('finite plane intersections recover all four exact points of the crossing-ellipse locus',()=>{
 const g=graph(),plane=plane3(0n,0n,1n,'-1/2'),hits=planePoints(g,plane);assert.equal(hits.length,4);
 for(const p of hits){assert.equal(p.z.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.x.mul(p.x).compare(AlgebraicReal.fromRational('1/4')),0);assert.equal(p.y.mul(p.y).compare(AlgebraicReal.fromRational('3/4')),0);}
 const clipped=clipCylinderIntersectionByHalfspaces3(g,[{plane,side:-1}]);check(clipped);assert.equal(clipped.arcs.length,6);assert.equal(clipped.isolatedPoints.length,0);assert.equal(clipped.ports.filter(p=>p.length===1).length,4);
 for(const arc of g.arcs){const split=splitCylinderIntersectionArcByPlane3(arc,plane);for(const piece of split.pieces){assert.equal(classifyPointToSurface3(piece.arc.sample,{kind:'plane',plane}),piece.side);assert.ok(pointOnCylinderIntersectionArc3(piece.arc.start,arc));assert.ok(pointOnCylinderIntersectionArc3(piece.arc.end,arc));}}
});
test('shared elliptic sections are overlaps, while opposite sheets meet only at their critical endpoints',()=>{
 const g=graph(),plane=plane3(-1n,0n,1n),hits=g.arcs.map(a=>intersectCylinderIntersectionArcPlane3(a,plane));assert.equal(hits.filter(h=>h.kind==='overlap').length,2);assert.equal(hits.filter(h=>h.kind==='points').length,2);
 for(const h of hits)if(h.kind==='points')assert.equal(h.points.length,2);
 const half=clipCylinderIntersectionByHalfspaces3(g,[{plane,side:-1}]);check(half);assert.equal(half.arcs.length,3);assert.ok(half.ports.every(p=>p.length===3));
 const section=clipCylinderIntersectionByHalfspaces3(half,[{plane,side:1}]);check(section);assert.equal(section.arcs.length,2);assert.ok(section.ports.every(p=>p.length===2));assert.equal(section.supportSingularVertices.length,2);
 for(const a of section.arcs)assert.equal(classifyPointToSurface3(a.sample,{kind:'plane',plane}),0);
});
test('axis-parallel tangent cuts retain isolated curve contacts rather than regularizing them away',()=>{
 const g=graph(),plane=plane3(1n,0n,0n,-1n),hits=planePoints(g,plane);assert.equal(hits.length,2);
 const points=clipCylinderIntersectionByHalfspaces3(g,[{plane,side:1}]);check(points);assert.equal(points.arcs.length,0);assert.equal(points.isolatedPoints.length,2);assert.equal(points.supportSingularVertices.length,0);
 const upper=clipCylinderIntersectionByHalfspaces3(points,[{plane:plane3(0n,0n,1n),side:1}]);assert.equal(upper.isolatedPoints.length,1);assert.ok(same(upper.isolatedPoints[0]!,algebraicCoordinates3(1n,0n,1n)));
 const node=clipCylinderIntersectionByHalfspaces3(g,[{plane:plane3(0n,1n,0n,-1n),side:1}]);check(node);assert.equal(node.arcs.length,0);assert.equal(node.isolatedPoints.length,1);assert.equal(node.supportSingularVertices.length,1);assert.equal(node.singularVertices.length,0);
 const empty=clipCylinderIntersectionByHalfspaces3(upper,[{plane:plane3(1n,0n,0n,-2n),side:1}]);assert.equal(empty.vertices.length,0);assert.equal(empty.components.length,0);
});
test('general quartic plane sections use exact rational recovery with positive and negative denominators',()=>{
 const b=cylinder3(line3(O,point3(1n,0n,1n)),1n),g=graph(A,b),s2=AlgebraicReal.fromRational(2n).sqrt();
 for(const sign of [-1n,1n]){
  const height=new Rational(sign,2n),plane=plane3(0n,0n,1n,height.neg()),hits=planePoints(g,plane);assert.equal(hits.length,2);
  for(const p of hits){assert.equal(p.x.compare(s2.affine(new Rational(sign,2n),new Rational(-sign,2n))),0);assert.equal(p.y.mul(p.y).compare(s2.affine('1/2','1/4')),0);assert.equal(p.z.compare(AlgebraicReal.fromRational(height)),0);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:b}),0);}
  const clipped=clipCylinderIntersectionByHalfspaces3(g,[{plane,side:-1}]);check(clipped,A,b);assert.equal(clipped.ports.filter(p=>p.length===1).length,2);
 }
});
test('zero linear recovery coefficients preserve two distinct points over the same projected coordinate',()=>{
 const b=cylinder3(line3(O,point3(1n,1n,1n)),'2/3'),g=graph(A,b),hits=planePoints(g,plane3(0n,0n,1n));assert.equal(hits.length,4);
 for(const q of [algebraicCoordinates3(1n,0n),algebraicCoordinates3(-1n,0n),algebraicCoordinates3(0n,1n),algebraicCoordinates3(0n,-1n)])assert.ok(hits.some(p=>same(p,q)));
});
test('sequential halfspaces give the independently bounded two-cylinder bands and preserve endpoint closure',()=>{
 const g=graph(),h=[{plane:plane3(0n,0n,1n,'-1/2'),side:-1 as const},{plane:plane3(0n,0n,-1n,'-1/2'),side:-1 as const},{plane:plane3(-1n,0n,0n,'-1/4'),side:-1 as const},{plane:plane3(1n,0n,0n,'-3/4'),side:-1 as const}],clipped=clipCylinderIntersectionByHalfspaces3(g,h);check(clipped);assert.equal(clipped.components.length,2);
 for(let n=1n;n<=3n;n++)for(let m=-4n;m<=4n;m++){
  const den=n*n+m*m,x=new Rational(n*n-m*m,den),y=new Rational(2n*m*n,den);
  for(const sign of [-1n,1n]){const z=x.mul(new Rational(sign)),p=algebraicCoordinates3(x,y,z),expected=z.compare(Rational.parse('-1/2'))>=0&&z.compare(Rational.parse('1/2'))<=0&&x.compare(Rational.parse('-1/4'))>=0&&x.compare(Rational.parse('3/4'))<=0;assert.equal(on(p,clipped),expected);}
 }
 const reversed=clipCylinderIntersectionByHalfspaces3(g,[...h].reverse());for(const a of clipped.arcs)assert.equal(on(a.sample,reversed),true);for(const a of reversed.arcs)assert.equal(on(a.sample,clipped),true);
});
test('generic offset skew intersections are clipped with complete conic-plane candidates',()=>{
 const a=cylinder3(line3(O,Z),2n),b=cylinder3(line3(point3('1/3','2/5','1/7'),point3(1n,1n,1n)),1n),g=graph(a,b),plane=plane3(0n,0n,1n),clipped=clipCylinderIntersectionByHalfspaces3(g,[{plane,side:-1}]);check(clipped,a,b);assert.ok(clipped.arcs.length>0);assert.ok(clipped.ports.some(p=>p.length===1));
 for(const p of [...clipped.vertices,...clipped.arcs.map(a=>a.sample)])assert.ok(classifyPointToSurface3(p,{kind:'plane',plane})<=0);
 const positive=clipCylinderIntersectionByHalfspaces3(g,[{plane,side:1}]);check(positive,a,b);for(const a of g.arcs)assert.ok(on(a.sample,clipped)||on(a.sample,positive));
});
test('microscopic slabs preserve distinct cut points and supporting singularities after valence changes',()=>{
 const tiny=new Rational(1n,10n**20n),g=graph(),clipped=clipCylinderIntersectionByHalfspaces3(g,[{plane:plane3(0n,0n,1n,tiny.neg()),side:-1},{plane:plane3(0n,0n,-1n,tiny.neg()),side:-1}]);check(clipped);assert.equal(clipped.components.length,2);assert.equal(clipped.supportSingularVertices.length,2);assert.ok(clipped.ports.filter(p=>p.length===1).length>=4);
 for(const p of clipped.vertices)assert.ok(p.z.compare(AlgebraicReal.fromRational(tiny))<=0&&p.z.compare(AlgebraicReal.fromRational(tiny.neg()))>=0);
});
test('rational point certificates preserve nonminimal roots and negative denominator signs without trusting copies',()=>{
 const parameter=AlgebraicReal.isolate(new Polynomial([-2n,2n,1n,-1n])).find(r=>r.compare(AlgebraicReal.fromRational(1n))>0)!,W=new Polynomial([0n,-1n]),p=algebraicRationalPoint3(parameter,[new Polynomial([0n,0n,-1n]),new Polynomial([-1n]),new Polynomial()],W);
 assert.equal(snapshotExactPoint3(p),p);assert.equal(classifyPointToSurface3(p,{kind:'plane',plane:plane3(1n,-2n,0n)}),0);assert.equal(classifyPointToSurface3(p,{kind:'plane',plane:plane3(1n,-1n,0n)}),1);assert.equal(pointOnCircle3(p,circle3(O,Z,'5/2')),true);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:cylinder3(line3(O,Z),'5/2')}),0);
 const badConjugate=algebraicRationalPoint3(parameter,[new Polynomial([1n,1n]),new Polynomial(),new Polynomial()],new Polynomial([-1n,1n]));assert.equal(badConjugate.x.compare(parameter.affine(2n,3n)),0);
 assert.throws(()=>algebraicRationalPoint3(parameter,[new Polynomial([1n]),new Polynomial(),new Polynomial()],new Polynomial([-2n,0n,1n])),RangeError);
 const copy={...p,x:AlgebraicReal.fromRational(0n),parameter,numerators:[new Polynomial()],denominator:W};assert.equal(pointOnCircle3(copy,circle3(O,Z,'5/2')),false);
});
test('ownership, invalid planes, invalid halfspace sides and off-arc subdivision are rejected',()=>{
 const g=graph(),a=g.arcs[0]!,plane=plane3(0n,0n,1n);assert.throws(()=>intersectCylinderIntersectionArcPlane3({...a},plane),RangeError);assert.throws(()=>clipCylinderIntersectionByHalfspaces3({...g},[]),RangeError);
 assert.throws(()=>clipCylinderIntersectionByHalfspaces3(g,[{plane,side:0 as -1}]),RangeError);assert.throws(()=>intersectCylinderIntersectionArcPlane3(a,{normal:O,offset:new Rational(0n)}),RangeError);
 assert.equal(clipCylinderIntersectionByHalfspaces3(g,[]),g);assert.equal(pointOnCylinderIntersectionArc3(algebraicCoordinates3(0n,0n),a),false);
 assert.throws(()=>splitCylinderIntersectionArc3(a,[algebraicCoordinates3(0n,0n)]),RangeError);
 const p=evaluateCylinderIntersectionArc3(a,a.baseSample);assert.equal(pointOnArc3(a.baseSample,a.base),true);assert.ok(pointOnCylinderIntersectionArc3(p,a));
 const pieces=splitCylinderIntersectionArc3(a,[p]);assert.equal(pieces.length,2);for(const part of pieces){assert.equal(evaluateCylinderIntersectionArc3(part,part.base.start),part.start);assert.equal(evaluateCylinderIntersectionArc3(part,part.base.end),part.end);assert.ok(pointOnCylinderIntersectionArc3(part.sample,a));}
});
test('shifted nonunit axis parameters and negative plane scaling preserve physical cut geometry',()=>{
 const original=clipCylinderIntersectionByHalfspaces3(graph(),[{plane:plane3(0n,0n,1n,'-1/2'),side:-1}]);
 const a=cylinder3(line3(point3(0n,0n,7n),point3(0n,0n,-3n)),1n),b=cylinder3(line3(point3(5n,0n),point3(7n,0n,0n)),1n),changed=clipCylinderIntersectionByHalfspaces3(graph(a,b),[{plane:plane3(0n,0n,-7n,'7/2'),side:1}]);check(changed);
 assert.equal(changed.ports.filter(p=>p.length===1).length,4);assert.equal(changed.supportSingularVertices.length,2);
 for(const p of [...original.vertices,...original.arcs.map(a=>a.sample)])assert.ok(on(p,changed));for(const p of [...changed.vertices,...changed.arcs.map(a=>a.sample)])assert.ok(on(p,original));
});
