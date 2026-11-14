import {point3,nurbsCurve3,prepareNurbsParameterDomain2} from '../dist/index.js';
const ring=(points:readonly (readonly [bigint,bigint])[])=>points.map(([x,y],i)=>{const b=points[(i+1)%points.length]!;return nurbsCurve3(1,[point3(x,y,0n),point3(b[0],b[1],0n)],[0n,0n,1n,1n]);});
const outer=ring([[0n,0n],[10n,0n],[10n,10n],[0n,10n]]),hole=ring([[2n,2n],[2n,8n],[8n,8n],[8n,2n]]),domain=prepareNurbsParameterDomain2(outer,[hole]);
console.log({material:domain.locate(1n,1n),hole:domain.locate(5n,5n),holeBoundary:domain.locate(2n,5n),sample:{u:domain.sample.u.toString(),v:domain.sample.v.toString()},sampleLocation:domain.locate(domain.sample.u,domain.sample.v)});
