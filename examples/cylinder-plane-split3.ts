import {point3,vector3,line3,cylinder3,plane3,prepareCylinderFace3,splitCylinderFaceByPlane3} from '../dist/index.js';
const cylinder=cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n);
for(const [name,lower,upper,plane] of [
  ['oblique split',-2n,2n,plane3(1n,0n,-1n)],
  ['tangent generator',-2n,2n,plane3(1n,0n,0n,-1n)],
  ['cap contact',-1n,1n,plane3(1n,0n,-1n)],
] as const){
  const result=splitCylinderFaceByPlane3(prepareCylinderFace3(cylinder,lower,upper),plane);
  console.log(name,{
    sharedEdges:result.sharedEdges.length,
    negativeLoops:result.negative.loops?.length??null,
    positiveLoops:result.positive.loops?.length??null,
    empty:[result.negative.empty,result.positive.empty],
    incidenceAvailable:result.topology!==null,
  });
}
