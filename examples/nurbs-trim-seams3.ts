import {point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,analyzeNurbsTrimSeams3} from '../dist/index.js';
const K=[0n,0n,1n,1n],surface=nurbsSurface3(1,1,['0','1','1','3'].map(x=>[point3(x,0n,0n),point3(x,1n,0n)]),[0n,0n,'1/2','1/2',1n,1n],K);
const points=[point3('1/10','1/10',0n),point3('9/10','1/10',0n),point3('9/10','9/10',0n),point3('1/10','9/10',0n)],domain=prepareNurbsParameterDomain2(points.map((p,i)=>nurbsCurve3(1,[p,points[(i+1)%points.length]!],K))),report=analyzeNurbsTrimSeams3(surface,domain);
console.log({continuous:report.continuous,c1:report.c1,g1:report.g1,retainedIntervals:report.seams.map(s=>s.intervals.map(i=>({start:i.startParameter.rational?.toString(),end:i.endParameter.rational?.toString(),location:i.location})))});
