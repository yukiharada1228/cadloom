import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,algebraicCoordinates2,line2,lineInterval2,prepareExtrudeMaterialProgram3,Rational,point2,point3,circle2,circularArc2,strictCylinderMaterialProgramLocation3,extrudeBody3,locateBody3} from '../dist/index.js';
import {prepareChordProfileProgram3} from '../dist/convert/chord-profile-program3.js';
test('minor and major circular segments preserve parity and the directed chord side',()=>{
 for(const direction of ['ccw','cw'] as const){
  const ring=[{kind:'arc' as const,arc:circularArc2(circle2(point2(0n,0n),1n),point2(1n,0n),point2(0n,1n),{direction})},{kind:'segment' as const,segment:{start:point2(0n,1n),end:point2(1n,0n)}}];
  const program=prepareChordProfileProgram3(ring,new Rational(0n),new Rational(2n)),source=extrudeBody3([ring],2n);let count=0;
  for(let x=-8;x<=8;x++)for(let y=-8;y<=8;y++){
   const a=2*x+1,b=2*y+1,p=point3(`${a}/16`,`${b}/16`,1n),actual=strictCylinderMaterialProgramLocation3(program,p);if(actual===null)continue;
   const expected=a*a+b*b<256&&(direction==='ccw'?a+b>16:a+b<16);assert.equal(actual,expected?'inside':'outside');assert.equal(locateBody3(source,p),actual);count++;
  }assert.ok(count>270);
 }
});

test('chord fallback refuses irrational vertices while another exact support path can still handle them',()=>{
 const root=AlgebraicReal.fromRational(2n).sqrt(),a=algebraicCoordinates2(root,0n),b=algebraicCoordinates2(root.neg(),0n),ring=[{kind:'arc' as const,arc:circularArc2(circle2(point2(0n,0n),2n),a,b)},{kind:'line' as const,interval:lineInterval2(line2(point2(0n,0n),point2(1n,0n)),root.neg(),root)}];
 assert.throws(()=>prepareChordProfileProgram3(ring,new Rational(0n),new Rational(2n)),/rational boundary/);
 const program=prepareExtrudeMaterialProgram3(extrudeBody3([ring],2n));assert.equal(strictCylinderMaterialProgramLocation3(program,point3(0n,1n,1n)),'inside');
});
