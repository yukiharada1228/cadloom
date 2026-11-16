import test from 'node:test';
import assert from 'node:assert/strict';
import {locateNurbsSourceFace3,reverseNurbsCurve3,classifyNurbsSourceFaces3,buildNurbsSourceHalfedges3,buildNurbsSourceBoundaryComplex3,matchNurbsIntersectionSourceBoundary3,insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
import type {NurbsSurface3,NurbsIntersectionBoundaryNodes3,PreparedNurbsParameterDomain2} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],J=[-1n,-1n,-1n,1n,1n,1n];
function ring(a:string,b:string,c:string,d:string,hole=false){let p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];if(hole)p=p.reverse();return p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K));}
const unit=()=>prepareNurbsParameterDomain2(ring('0','0','1','1'));
const plane=(z='0')=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,z))),K,K);
function refined(s:NurbsSurface3,t:NurbsSurface3,d:PreparedNurbsParameterDomain2=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certificate');return refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),d,unit())));}
function closed(r:NurbsIntersectionBoundaryNodes3){for(const ids of r.rings)for(let i=0;i<ids.length;i++){const a=r.edges[ids[i]!]!,b=r.edges[ids[(i+1)%ids.length]!]!;assert.equal(a.to,b.from);assert.ok(a.lower.compare(a.upper)<0);}for(const [id,v] of r.intersectionVertices.entries())if(v!==null)assert.ok(r.vertices[v]!.intersectionVertices.includes(id));}
function prepare(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const f=classifyNurbsSourceFaces3(buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined(s,t,d))));assert.equal(f.kind,'classified');if(f.kind!=='classified')throw Error('Expected classified faces');return f;}
test('annular grid queries agree with independent rectangle and hole inequalities, including vertex rays',()=>{
 const d=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/3','1/3','2/3','2/3',true)]),f=prepare(plane(),plane(),d);
 for(let i=-1;i<=7;i++)for(let j=-1;j<=7;j++){const u=new Rational(BigInt(i),6n),v=new Rational(BigInt(j),6n),q=locateNurbsSourceFace3(f,u,v),closed=i>=0&&i<=6&&j>=0&&j<=6,hole=i>2&&i<4&&j>2&&j<4,boundary=closed&&(i===0||i===6||j===0||j===6)||i>=2&&i<=4&&j>=2&&j<=4&&(i===2||i===4||j===2||j===4);if(boundary){assert.ok(q.kind==='edge'||q.kind==='vertex');assert.equal(q.faces.length,2);}else{assert.equal(q.kind,'face');if(q.kind==='face')assert.equal(q.location,closed&&!hole?'inside':'outside');}}
 assert.throws(()=>locateNurbsSourceFace3({...f},0n,0n),/factory/);
});
test('a cut distinguishes its two incident faces from an ordinary inside query',()=>{
 const t=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),K,K),f=prepare(plane(),t),left=locateNurbsSourceFace3(f,'1/4','1/2'),right=locateNurbsSourceFace3(f,'3/4','1/2');assert.equal(left.kind,'face');assert.equal(right.kind,'face');if(left.kind==='face'&&right.kind==='face')assert.notEqual(left.face,right.face);
 const cut=locateNurbsSourceFace3(f,'1/2','1/3');assert.ok(cut.kind==='edge'||cut.kind==='vertex');assert.equal(cut.faces.length,2);const end=locateNurbsSourceFace3(f,'1/2',0n);assert.equal(end.kind,'vertex');if(end.kind==='vertex')assert.equal(end.faces.length,3);
});
test('circle queries match a rational squared-distance oracle and exact algebraic boundary points',()=>{
 const q=[new Rational(1n,4n),new Rational(-1n,4n),new Rational(1n,4n)],xy=[0n,'1/2',1n],s=nurbsSurface3(2,2,xy.map((u,i)=>xy.map((v,j)=>point3(u,v,q[i]!.add(q[j]!).sub(new Rational(1n,16n))))),K2,K2),f=prepare(s,plane()),inside=f.faces.map((p,id)=>({p,id})).filter(x=>x.p.location==='inside'),disk=inside.find(({p})=>{const x=p.sample.u.sub(new Rational(1n,2n)),y=p.sample.v.sub(new Rational(1n,2n));return x.mul(x).add(y.mul(y)).compare(new Rational(1n,16n))<0;})!.id,annulus=inside.find(x=>x.id!==disk)!.id;
 for(let i=1;i<8;i++)for(let j=1;j<8;j++){const u=new Rational(BigInt(i),8n),v=new Rational(BigInt(j),8n),x=u.sub(new Rational(1n,2n)),y=v.sub(new Rational(1n,2n)),sign=x.mul(x).add(y.mul(y)).compare(new Rational(1n,16n)),r=locateNurbsSourceFace3(f,u,v);if(sign===0)assert.ok(r.kind==='edge'||r.kind==='vertex');else{assert.equal(r.kind,'face');if(r.kind==='face')assert.equal(r.face,sign<0?disk:annulus);}}
 const a=AlgebraicReal.fromRational('1/32').sqrt().affine(1n,'1/2'),b=locateNurbsSourceFace3(f,a,a);assert.ok(b.kind==='edge'||b.kind==='vertex');assert.equal(b.faces.length,2);
});
test('wire incidence preserves one enclosing face and its endpoint vertices',()=>{
 const knots=['1/4','1/4','3/4','3/4'],s=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(u).sub(new Rational(1n,2n))))),knots,knots),f=prepare(s,plane()),mid=locateNurbsSourceFace3(f,'1/2','1/2'),end=locateNurbsSourceFace3(f,'1/2','1/4');assert.ok(mid.kind==='edge'||mid.kind==='vertex');assert.equal(mid.faces.length,1);assert.equal(end.kind,'vertex');if(end.kind==='vertex')assert.equal(end.faces.length,1);
});

test('isolated contact vertices retain their containing face without fabricated edges',()=>{
 const q=[new Rational(1n,4n),new Rational(-1n,4n),new Rational(1n,4n)],xy=[0n,'1/2',1n],s=nurbsSurface3(2,2,xy.map((u,i)=>xy.map((v,j)=>point3(u,v,q[i]!.add(q[j]!)))),K2,K2),f=prepare(s,plane()),r=locateNurbsSourceFace3(f,'1/2','1/2');assert.equal(r.kind,'vertex');if(r.kind==='vertex'){assert.equal(r.edges.length,0);assert.equal(r.faces.length,1);assert.equal(f.faces[r.faces[0]!]!.location,'inside');}
});
test('a shared UV seam with distinct spatial images locates one edge incident to two faces',()=>{
 const s=nurbsSurface3(1,1,[[point3(0n,0n,-1n),point3(0n,1n,-1n)],[point3('1/4',0n,0n),point3('1/4',1n,0n)],[point3('3/4',0n,0n),point3('3/4',1n,0n)],[point3(1n,0n,1n),point3(1n,1n,1n)]],[0n,0n,'1/2','1/2',1n,1n],K),f=classifyNurbsSourceFaces3(buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined(s,plane())))),r=locateNurbsSourceFace3(f,'1/2','1/2');assert.equal(r.kind,'edge');if(r.kind==='edge'){assert.equal(r.edges.length,1);assert.equal(r.faces.length,2);}
});
