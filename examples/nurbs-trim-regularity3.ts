import {point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,analyzeNurbsTrimRegularity3,reverseNurbsCurve3} from '../dist/index.js';
const K=[0n,0n,1n,1n],surface=nurbsSurface3(1,2,[0n,1n].map(u=>['1/4','-1/4','1/4'].map(v=>point3(u,v,0n))),K,[0n,0n,0n,1n,1n,1n]);
const ring=(coordinates:readonly (readonly [string,string])[])=>coordinates.map(([u,v],i)=>{const b=coordinates[(i+1)%coordinates.length]!;return nurbsCurve3(1,[point3(u,v,0n),point3(b[0],b[1],0n)],K);});
const outer=ring([['1/10','1/10'],['9/10','1/10'],['9/10','9/10'],['1/10','9/10']]),hole=ring([['1/4','1/4'],['3/4','1/4'],['3/4','3/4'],['1/4','3/4']]).reverse().map(reverseNurbsCurve3),report=analyzeNurbsTrimRegularity3(surface,prepareNurbsParameterDomain2(outer,[hole]));
console.log({regular:report.regular,retained:report.patches[0]!.edges.map(e=>({from:e.start.u.rational?.toString(),to:e.end.u.rational?.toString(),v:e.sample.v.rational?.toString(),location:e.location}))});
