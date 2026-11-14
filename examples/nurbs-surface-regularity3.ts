import {point3,nurbsSurface3,analyzeNurbsSurfaceRegularity3} from '../dist/index.js';
// S(u,v)=(u,v³/3-v/2,0). Its normal vanishes at v=sqrt(1/2).
const surface=nurbsSurface3(1,3,[0n,1n].map(u=>['0','-1/6','-1/3','-1/6'].map(y=>point3(u,y,0n))),[0n,0n,1n,1n],[0n,0n,0n,0n,1n,1n,1n,1n]);
const report=analyzeNurbsSurfaceRegularity3(surface),locus=report.patches[0]!.locus!;
console.log({continuous:report.continuous,everyPatchRegular:report.everyPatchRegular,kind:locus.kind,branches:locus.edges.length,vertices:locus.vertices.map(p=>({u:p.u.rational?.toString(),vCertificate:p.v.polynomial.coefficients.map(c=>c.toString())}))});
