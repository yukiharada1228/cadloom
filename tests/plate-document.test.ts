import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlate,defaultParameters,restorePlate,serializePlate} from '../examples/editor/model.ts';

test('plate document round-trips dimensions and exact derived geometry without numeric coercion',()=>{
 const parameters={...defaultParameters,width:'10.25',depth:'25/3',thickness:'1/7',hole:{x:'1/3',y:'1/4',width:'2.5',depth:'3/2'}};
 const original=buildPlate(parameters),text=serializePlate(original),restored=restorePlate(text);
 assert.equal(restored.document.parameters.width,'41/4');
 assert.equal(restored.document.parameters.hole!.width,'5/2');
 assert.equal(restored.mesh.volume.toString(),'35/3');
 assert.deepEqual(restored,original);
 const saved=JSON.parse(text);
 assert.equal(typeof saved.mesh.vertices[0].x,'string');
 assert.equal(typeof saved.mesh.volume,'string');
 assert.ok(Object.isFrozen(restored.document.parameters.hole));
 // Restore source dimensions, never a forged derived mesh.
 saved.mesh={volume:'0',vertices:[],triangles:[]};
 assert.deepEqual(restorePlate(JSON.stringify(saved)),original);
});
test('plate dimension validation rejects invalid holes, non-string coordinates and unsupported documents',()=>{
 for(const width of ['0','-1','NaN','1e5','',4])assert.throws(()=>buildPlate({...defaultParameters,width}));
 for(const hole of [undefined,{}, {x:'0',y:'1',width:'2',depth:'2'}, {x:'1',y:'1',width:'7',depth:'2'}]){
  assert.throws(()=>buildPlate({...defaultParameters,hole}));
 }
 assert.throws(()=>restorePlate('{'),SyntaxError);
 assert.throws(()=>restorePlate(JSON.stringify({format:'cadloom.plate',version:2,parameters:defaultParameters})),/バージョン/);
 assert.throws(()=>restorePlate(JSON.stringify({format:'other',version:1,parameters:defaultParameters})));
 assert.throws(()=>restorePlate('null'));
 const solid=buildPlate({...defaultParameters,hole:null});
 assert.equal(solid.mesh.volume.toString(),'128');
});
test('plate documents preserve large rational dimensions and snapshot caller-owned parameters',()=>{
 const parameters={width:'9007199254740993123456789',depth:'1/3',thickness:'1/1000000000000000000000000000000',hole:null};
 const model=buildPlate(parameters);
 parameters.width='1';
 const restored=restorePlate(serializePlate(model));
 assert.equal(restored.document.parameters.width,'9007199254740993123456789');
 assert.deepEqual(restored.mesh,model.mesh);
});
