import {point2,circle2,fullCircleArc2,buildCurveHalfEdges2,AlgebraicReal} from '../dist/index.js';
const result=buildCurveHalfEdges2([
  {kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),1n))},
  {kind:'arc',arc:fullCircleArc2(circle2(point2(2n,0n),1n))},
]);
const contact=result.vertices.findIndex(v=>v.point.x.equals(AlgebraicReal.fromRational(1n))&&v.point.y.equals(AlgebraicReal.fromRational(0n)));
console.log(JSON.stringify({
  vertices:result.vertices.length,edges:result.edges.length,
  boundaryWalkLengths:result.boundaries.map(w=>w.halfEdges.length).sort((a,b)=>a-b),
  contactGerms:result.outgoing[contact]!.map(id=>{
    const h=result.halfEdges[id]!;
    return {sources:result.edges[h.edge]!.sources,tangentSigns:[h.germ.tangent.x.sign(),h.germ.tangent.y.sign()],curvatureSign:h.germ.curvatureSign,radiusSquared:h.germ.radiusSquared?.toString()};
  }),
},null,2));
