import {buildCurveFaces2,circle2,fullCircleArc2,point2,segment2} from '../dist/index.js';

const arrangement=buildCurveFaces2([
  {kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),4n))},
  {kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),1n))},
  {kind:'segment',segment:segment2(point2(0n,'-1/2'),point2(0n,'1/2'))},
]);
console.log(arrangement.faces.map((face,id)=>({
  id,bounded:face.bounded,boundaries:face.boundaries,
  sample:{x:String(face.sample.x),y:String(face.sample.y)},
  located:arrangement.locate(face.sample),
})));
console.log('annulus:',arrangement.locate(point2('3/2',0n)));
console.log('slit:',arrangement.locate(point2(0n,0n)));
