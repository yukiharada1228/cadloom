import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,Rational,point2,point3,vector3,line3,plane3,cylinder3,clipCylinderBRep3,extrudeCurveRegionBRep3,bodyRecordFromTopology3,readBodyRecord3,stringifyBodyRecord3,parseBodyRecord3,decodeBodyGeometry3,encodeExactReal3,decodeExactReal3,encodeExactPoint3,decodeExactPoint3,algebraicPoint3,compareAlgebraicPoints3,curveEndpoints3,encodeCurveRecord3,decodeCurveRecord3,encodeSurfaceRecord3,decodeSurfaceRecord3,planeFrame3,circle2,circularArc2,planarArc3,ellipse3,fullEllipseArc3,circle3,fullCircleArc3,algebraicSegment3,lineInterval3,nurbsCurve3,nurbsSurface3,evaluateNurbsCurve3,evaluateNurbsSurface3} from '../dist/index.js';
import type {BodyRecord3,Curve3,ExactRealRecord3,RecordCurveGeometry3,RecordSurfaceGeometry3} from '../dist/index.js';
const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
const empty=():BodyRecord3=>({version:1,units:'mm',coordinates:'right-handed-z-up',curves:[],surfaces:[],vertices:[],edges:[],loops:[],faces:[],shells:[],regions:[{shells:[],void:false}]});
const box=()=>{const points=[point2(0n,0n),point2(2n,0n),point2(2n,3n),point2(0n,3n)],r=extrudeCurveRegionBRep3([points.map((start,i)=>({kind:'segment' as const,segment:{start,end:points[(i+1)%4]!}}))],4n);return bodyRecordFromTopology3(r.topology,[{shells:[0],void:false},{shells:[0],void:false}]);};
function endpointAgreement(r:BodyRecord3){const d=decodeBodyGeometry3(r);for(const e of r.edges){const c=d.curves[e.curve]!;assert.notEqual(c.kind,'nurbs');const ends=curveEndpoints3(c as Curve3);assert.equal(compareAlgebraicPoints3(ends[0],d.vertices[e.start]!),0);assert.equal(compareAlgebraicPoints3(ends[1],d.vertices[e.end]!),0);}return d;}
test('huge rationals and independent real root branches round trip without Number conversion',()=>{
  const q=new Rational(10n**80n+1n,10n**40n),a=AlgebraicReal.fromRational(2n).sqrt(),b=a.neg();for(const x of [AlgebraicReal.fromRational(q),a,b,AlgebraicReal.fromRational('1/2').sqrt()]){const r=encodeExactReal3(x),s=JSON.stringify(r);assert.equal(decodeExactReal3(JSON.parse(s)).compare(x),0);assert.ok(!s.includes('e+'));}
  const p=new Polynomial([-2n,0n,1n]),roots=AlgebraicReal.isolate(p);assert.equal(decodeExactReal3(encodeExactReal3(roots[0]!)).sign(),-1);assert.equal(decodeExactReal3(encodeExactReal3(roots[1]!)).sign(),1);
});
test('algebraic certificates reject ambiguous, rootless, endpoint-root and zero-polynomial records',()=>{
  const r=(polynomial:readonly string[],lower:string,upper:string):ExactRealRecord3=>({kind:'root',polynomial,lower,upper});for(const x of [r(['-2','0','1'],'-2','2'),r(['-2','0','1'],'2','3'),r(['0','1'],'0','1'),r(['0','0'],'-1','1'),r(['-2','0','1'],'2','1')])assert.throws(()=>decodeExactReal3(x),/certificate/);
});
test('registered affine point correlations survive JSON encoding and ignore forged metadata',()=>{
  const t=AlgebraicReal.fromRational(2n).sqrt(),p=algebraicPoint3(point3(10n,20n,30n),vector3(1n,2n,3n),t),r=encodeExactPoint3(p);assert.equal(r.kind,'affine');assert.equal(compareAlgebraicPoints3(decodeExactPoint3(clone(r)),p),0);assert.equal(encodeExactPoint3({...p}).kind,'coordinates');
});
test('empty and box boundary records snapshot, freeze and retain explicit material-region declarations',()=>{
  assert.deepEqual(parseBodyRecord3(stringifyBodyRecord3(empty())),empty());const original=box(),r=readBodyRecord3(original);assert.equal(r.vertices.length,8);assert.equal(r.edges.length,12);assert.equal(r.faces.length,6);assert.equal(r.regions.length,2);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.faces)&&Object.isFrozen(r.faces[0]!.loops));const d=endpointAgreement(parseBodyRecord3(stringifyBodyRecord3(r)));assert.equal(d.record.version,1);assert.equal('locate' in d,false);assert.equal('certified' in d,false);
});
test('a clipped cylinder retains elliptic arcs and exact algebraic vertices through serialization',()=>{
  const r=clipCylinderBRep3(cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n),-2n,2n,[{plane:plane3(1n,0n,1n,0n),side:-1}]),record=bodyRecordFromTopology3(r.topology,[{shells:[0],void:false},{shells:[0],void:false}]);assert.ok(record.curves.some(c=>c.kind==='ellipse'));endpointAgreement(parseBodyRecord3(stringifyBodyRecord3(record)));
});
test('all native bounded curve kinds preserve endpoints, orientation and support data',()=>{
  const o=point3(0n,0n,0n),frame=planeFrame3(o,vector3(2n,0n,0n),vector3(0n,3n,0n)),curves:Curve3[]=[{kind:'line',interval:lineInterval3(line3(o,vector3(1n,2n,3n)),'-1/3','2/3')},{kind:'algebraic-segment',segment:algebraicSegment3(o,point3(1n,2n,3n))},{kind:'circular-arc',arc:fullCircleArc3(circle3(o,vector3(0n,0n,1n),2n))},{kind:'elliptic-arc',arc:fullEllipseArc3(ellipse3(frame,2n,3n))},{kind:'planar-arc',arc:planarArc3(frame,circularArc2(circle2(point2(0n,0n),1n),point2(1n,0n),point2(0n,1n),{direction:'cw'}))}];
  for(const c of curves){const record=encodeCurveRecord3(c),copy=decodeCurveRecord3(clone(record));assert.notEqual(copy.kind,'nurbs');assert.deepEqual(encodeCurveRecord3(copy),record);const a=curveEndpoints3(c),b=curveEndpoints3(copy as Curve3);assert.equal(compareAlgebraicPoints3(a[0],b[0]),0);assert.equal(compareAlgebraicPoints3(a[1],b[1]),0);}
});
test('weighted NURBS curve and surface geometry round trip with exact algebraic evaluation',()=>{
  const k=[0n,0n,1n,1n],curve=nurbsCurve3(2,[point3(1n,0n,0n),point3(1n,1n,0n),point3(0n,1n,0n)],[0n,0n,0n,1n,1n,1n],[1n,1n,2n]),surface=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],k,k,[[1n,2n],[3n,4n]]),c=decodeCurveRecord3(clone(encodeCurveRecord3({kind:'nurbs',curve}))),s=decodeSurfaceRecord3(clone(encodeSurfaceRecord3({kind:'nurbs',surface}))),t=AlgebraicReal.fromRational('1/2').sqrt();assert.equal(c.kind,'nurbs');assert.equal(s.kind,'nurbs');if(c.kind==='nurbs'&&s.kind==='nurbs'){assert.equal(compareAlgebraicPoints3(evaluateNurbsCurve3(curve,t),evaluateNurbsCurve3(c.curve,t)),0);assert.equal(compareAlgebraicPoints3(evaluateNurbsSurface3(surface,t,'1/3'),evaluateNurbsSurface3(s.surface,t,'1/3')),0);}
});
test('strict structural validation rejects wrong versions, fields, scalar encodings and dangling IDs',()=>{
  const r=box();for(const mutate of [(x:any)=>x.version=2,(x:any)=>x.extra=true,(x:any)=>x.curves[0].origin[0]=0,(x:any)=>x.edges[0].curve=999,(x:any)=>x.edges[0].start=-1,(x:any)=>x.faces[0].surface=99,(x:any)=>x.faces[0].sense=0,(x:any)=>x.regions[0].void=true,(x:any)=>x.regions[1].shells=[99]]){const b=clone(r);mutate(b);assert.throws(()=>readBodyRecord3(b),RangeError);}
});
test('loop closure, ownership and duplicate references are checked independently of coordinates',()=>{
  const r=box();for(const mutate of [(x:any)=>x.loops[0].uses[0].direction*=-1,(x:any)=>x.faces[0].loops.push(x.faces[0].loops[0]),(x:any)=>x.shells[0].faces.pop(),(x:any)=>x.regions[0].shells.push(0),(x:any)=>x.regions.push({shells:[0],void:true}),(x:any)=>x.vertices.push(x.vertices[0])]){const b=clone(r);mutate(b);assert.throws(()=>readBodyRecord3(b),RangeError);}
});
test('structurally valid geometry is not silently certified: degenerate planes and bad roots fail construction',()=>{
  const r=clone(box()) as any;r.surfaces[0].normal=['0','0','0'];assert.ok(readBodyRecord3(r));assert.throws(()=>decodeBodyGeometry3(r),RangeError);const b=clone(box()) as any;b.vertices[0]={kind:'coordinates',x:{kind:'root',polynomial:['-2','0','1'],lower:'-2',upper:'2'},y:{kind:'rational',value:'0'},z:{kind:'rational',value:'0'}};assert.ok(readBodyRecord3(b));assert.throws(()=>decodeBodyGeometry3(b),/certificate/);
});
test('pcurve geometry must be local z=0 while correspondence remains a separate obligation',()=>{
  const r=clone(box()) as any;r.curves.push({kind:'line',origin:['0','0','1'],direction:['1','0','0'],start:{kind:'rational',value:'0'},end:{kind:'rational',value:'1'}});r.loops[0].uses[0].pcurve=r.curves.length-1;assert.ok(readBodyRecord3(r));assert.throws(()=>decodeBodyGeometry3(r),/pcurve/);r.curves[r.curves.length-1].origin[2]='0';assert.ok(decodeBodyGeometry3(r));
});
test('read budgets, sparse arrays, inherited fields and malformed spline dimensions fail explicitly',()=>{
  assert.throws(()=>readBodyRecord3(box(),{maxItems:10}),/budget/);assert.throws(()=>readBodyRecord3(box(),{maxNumericCharacters:2}),/budget/);assert.throws(()=>readBodyRecord3(empty(),{maxItems:0}),/limits/);assert.throws(()=>parseBodyRecord3(' '.repeat(1000),{maxItems:1,maxNumericCharacters:1}),/budget/);const inherited=Object.create(empty());assert.throws(()=>readBodyRecord3(inherited),/missing/);const r=clone(box()) as any;r.vertices=Array(8);assert.throws(()=>readBodyRecord3(r),RangeError);const b=clone(empty()) as any;b.curves=[{kind:'nurbs',degree:2,points:[],weights:[],knots:[]}];assert.throws(()=>readBodyRecord3(b),/counts/);
});

test('wire and isolated-vertex shells are represented without inventing faces or bounded material',()=>{
  const b=clone(empty()) as any;b.vertices=[encodeExactPoint3({x:AlgebraicReal.fromRational(0n),y:AlgebraicReal.fromRational(0n),z:AlgebraicReal.fromRational(0n)}),encodeExactPoint3({x:AlgebraicReal.fromRational(1n),y:AlgebraicReal.fromRational(0n),z:AlgebraicReal.fromRational(0n)})];b.curves=[{kind:'line',origin:['0','0','0'],direction:['1','0','0'],start:{kind:'rational',value:'0'},end:{kind:'rational',value:'1'}}];b.edges=[{curve:0,start:0,end:1}];b.shells=[{kind:'wire',edges:[0]}];b.regions=[{shells:[0],void:false}];assert.equal(readBodyRecord3(b).shells[0]!.kind,'wire');assert.equal(decodeBodyGeometry3(b).curves.length,1);const v=clone(empty()) as any;v.vertices=[b.vertices[0]];v.shells=[{kind:'vertex',vertex:0}];v.regions=[{shells:[0],void:false}];assert.equal(readBodyRecord3(v).shells[0]!.kind,'vertex');
});
test('a material region with an inner void preserves shared shell roles without claiming containment',()=>{
  const a=box(),n=a.vertices.length,e=a.edges.length,c=a.curves.length,f=a.faces.length,l=a.loops.length,s=a.surfaces.length;
  const b={...a,vertices:[...a.vertices,...a.vertices],curves:[...a.curves,...a.curves],surfaces:[...a.surfaces,...a.surfaces],edges:[...a.edges,...a.edges.map(x=>({...x,curve:x.curve+c,start:x.start+n,end:x.end+n}))],loops:[...a.loops,...a.loops.map(x=>({uses:x.uses.map(u=>({...u,edge:u.edge+e}))}))],faces:[...a.faces,...a.faces.map(x=>({...x,surface:x.surface+s,loops:x.loops.map(i=>i+l)}))],shells:[...a.shells,{kind:'faces' as const,faces:a.faces.map((_,face)=>({face:face+f,direction:-1 as const})),wires:[]}],regions:[{shells:[0],void:false},{shells:[0,1],void:false},{shells:[1],void:true}]};
  // Deliberately coincident geometry: reference validity does not prove embedding.
  const r=readBodyRecord3(b);assert.deepEqual(r.regions,b.regions);assert.equal(decodeBodyGeometry3(r).vertices.length,16);
});
test('record snapshots do not retain caller mutations and malformed rational strings are rejected',()=>{
  const raw=clone(box()) as any,r=readBodyRecord3(raw);raw.edges[0].start=999;assert.notEqual(r.edges[0]!.start,999);for(const text of ['1e30','NaN','01','1/0','1.5']){const x=clone(box()) as any;x.curves[0].origin[0]=text;assert.throws(()=>readBodyRecord3(x),/rational/);}
});
