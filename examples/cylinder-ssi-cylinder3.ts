import {point3,line3,cylinder3,intersectCylinders3,intersectCylinderIntersectionArcCylinder3,splitCylinderIntersectionArcByCylinder3,compareAlgebraicPoints3} from '../dist/index.js';
const O=point3(0n,0n),first=cylinder3(line3(O,point3(0n,0n,1n)),1n),second=cylinder3(line3(O,point3(1n,0n,0n)),4n),third=cylinder3(line3(O,point3(0n,1n,0n)),4n),graph=intersectCylinders3(first,second);
if(graph.kind!=='bounded')throw new Error('Expected bounded SSI');
const points=graph.arcs.flatMap(arc=>{const hit=intersectCylinderIntersectionArcCylinder3(arc,third);return hit.kind==='points'?hit.points:[];}),distinct=points.filter((p,i)=>points.findIndex(q=>compareAlgebraicPoints3(p,q)===0)===i),split=splitCylinderIntersectionArcByCylinder3(graph.arcs[0]!,third);
console.log({sourceArcs:graph.arcs.length,distinctTriplePoints:distinct.length,splitPieces:split.pieces.length,openPieceSides:split.pieces.map(p=>p.side)});
