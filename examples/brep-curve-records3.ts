import {point3,line3,cylinder3,intersectCylinders3,splitCylinderIntersectionArc3,cylinderIntersectionBRepCurve3,encodeBRepCurveRecord3,decodeBRepCurveRecord3,brepCurveEndpoints3,compareAlgebraicPoints3,pointOnBRepCurve3} from '../dist/index.js';
const first=cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),1n),second=cylinder3(line3(point3(0n,0n),point3(1n,0n,0n)),4n),graph=intersectCylinders3(first,second);
if(graph.kind!=='bounded')throw new Error('Expected bounded SSI');
const arc=graph.arcs[0]!,trimmed=splitCylinderIntersectionArc3(arc,[arc.sample])[0]!,original=cylinderIntersectionBRepCurve3(trimmed,-1),json=JSON.stringify(encodeBRepCurveRecord3(original)),restored=decodeBRepCurveRecord3(JSON.parse(json)),a=brepCurveEndpoints3(original),b=brepCurveEndpoints3(restored);
console.log({bytes:json.length,kind:restored.kind,exactEndpointAgreement:a.every((p,i)=>compareAlgebraicPoints3(p,b[i]!)===0),trimmedSampleRetained:pointOnBRepCurve3(trimmed.sample,restored)});
