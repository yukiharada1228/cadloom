import {point3,vector3,line3,cylinder3,plane3,prepareCylinderFace3,prepareTrimmedCylinder3,
  extractTrimmedCylinderComponent3,splitTrimmedCylinderByPlane3} from '../dist/index.js';
const base=prepareCylinderFace3(cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n),-2n,2n);
const strip=prepareTrimmedCylinder3(base,[
  {plane:plane3(1n,0n,0n,'-1/2'),side:-1},
  {plane:plane3(-1n,0n,0n,'-1/2'),side:-1},
]);
console.log('Vertical strip components:',strip.components.length);
const split=splitTrimmedCylinderByPlane3(strip,plane3(0n,0n,1n));
console.log('Repeated split:',{
  negativeComponents:split.negative.components.length,
  positiveComponents:split.positive.components.length,
  sharedEdges:split.sharedEdges.length,
  incidenceFaces:split.topology?.faces.length??null,
});
const single=extractTrimmedCylinderComponent3(strip,0);
const again=splitTrimmedCylinderByPlane3(single,plane3(0n,0n,1n));
console.log('Extracted component split:',[again.negative.components.length,again.positive.components.length]);
