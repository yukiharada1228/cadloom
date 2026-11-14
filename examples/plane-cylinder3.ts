import {point3,vector3,line3,cylinder3,plane3,intersectPlaneCylinder3,
  fullEllipseArc3,curveOnSurface3,intersectLineEllipse3} from '../dist/index.js';

const cylinder=cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n);
for(const [name,plane] of [
  ['oblique',plane3(1n,0n,-1n,0n)],
  ['secant',plane3(1n,0n,0n,0n)],
  ['tangent',plane3(1n,0n,0n,-1n)],
  ['miss',plane3(1n,0n,0n,-2n)],
] as const){
  const section=intersectPlaneCylinder3(plane,cylinder);
  console.log(name,section.kind,section.kind==='lines'?section.lines.map(l=>l.multiplicity):'');
  if(section.kind==='ellipse'){
    const arc=fullEllipseArc3(section.ellipse);
    console.log('whole ellipse on cylinder:',curveOnSurface3({kind:'elliptic-arc',arc},{kind:'cylinder',cylinder}));
    console.log('diameter hits:',intersectLineEllipse3(line3(point3(0n,0n,0n),vector3(1n,0n,1n)),section.ellipse).length);
  }
}
