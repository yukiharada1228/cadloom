import {point3,vector3,line3,cylinder3,plane3,clipCylinderBRep3} from '../dist/index.js';
const cylinder=cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n);
for(const [name,halfspaces] of [
  ['oblique cap',[{plane:plane3(1n,0n,1n),side:-1}]],
  ['parallel strip',[{plane:plane3(1n,0n,0n,'-1/2'),side:-1},{plane:plane3(-1n,0n,0n,'-1/2'),side:-1}]],
  ['touching caps',[{plane:plane3(1n,0n,1n,-1n),side:-1},{plane:plane3(1n,0n,-1n,-1n),side:-1}]],
] as const){
  const solid=clipCylinderBRep3(cylinder,-2n,2n,halfspaces),t=solid.topology;
  console.log(name,{
    faces:t.faces.length,edges:t.edges.length,vertices:t.vertices.length,
    closed:t.closedOrientedIncidence,shells:t.shells.length,
    euler:t.vertices.length-t.edges.length+t.faces.length,
    interiorSample:solid.interiorSample&&[solid.interiorSample.x,solid.interiorSample.y,solid.interiorSample.z].map(q=>q.toString()),
  });
}
