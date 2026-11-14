import {point3,nurbsCurve3,nurbsSurface3,insertNurbsSurfaceKnot3,liftNurbsSurfaceBoundary3,evaluateNurbsSurfaceBoundaryPiece3} from '../dist/index.js';
const k=[0n,0n,1n,1n];
const surface=insertNurbsSurfaceKnot3(nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],k,k),'u','1/2');
// (u,v)=(t²,t), lifted to (t²,t,t³). The knot u=1/2 has t=sqrt(1/2).
const parameterCurve=nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,'1/2',0n),point3(1n,1n,0n)],[0n,0n,0n,1n,1n,1n]);
const boundary=liftNurbsSurfaceBoundary3(surface,parameterCurve),cut=boundary.pieces[0]!.endParameter,point=evaluateNurbsSurfaceBoundaryPiece3(boundary,0,cut);
console.log({pieces:boundary.pieces.length,cutCertificate:cut.polynomial.coefficients.map(x=>x.toString()),point:{x:point.x.rational?.toString(),yCertificate:point.y.polynomial.coefficients.map(x=>x.toString()),zCertificate:point.z.polynomial.coefficients.map(x=>x.toString())}});
