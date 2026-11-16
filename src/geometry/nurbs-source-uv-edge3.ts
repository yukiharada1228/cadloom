import type {AlgebraicReal} from '../numeric/real-roots.js';
import {bivariateFiberRoots} from '../numeric/bivariate-system.js';
import {nurbsBoundaryCoordinateRoots3} from './nurbs-intersection-boundary-nodes3.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {refinedNurbsAffineIntersectionEdgePoint3} from './nurbs-affine-intersection-refine3.js';
import type {NurbsSourceBoundaryComplex3} from './nurbs-source-boundary-complex3.js';
type UV=Readonly<{u:AlgebraicReal;v:AlgebraicReal}>;
/** Internal selected finite UV-atom fiber. null denotes whole-fiber support;
 * callers choose a nonconstant coordinate or keep an unresolved result. */
export function sourceUvEdgeAtCoordinate3(c:NurbsSourceBoundaryComplex3,edge:number,axis:'u'|'v',at:AlgebraicReal,closed=true):readonly UV[]|null {
 const e=c.edges[edge]!,a=c.vertices[e.from]!,b=c.vertices[e.to]!,between=(x:AlgebraicReal,lo:AlgebraicReal,hi:AlgebraicReal)=>closed?x.compare(lo)>=0&&x.compare(hi)<=0:x.compare(lo)>0&&x.compare(hi)<0;
 if(a[axis].compare(b[axis])===0)return at.compare(a[axis])===0?null:[];
 const lo=a[axis].compare(b[axis])<0?a[axis]:b[axis],hi=a[axis].compare(b[axis])<0?b[axis]:a[axis];if(!between(at,lo,hi))return [];
 if(closed){if(at.compare(a[axis])===0)return [Object.freeze({u:a.u,v:a.v})];if(at.compare(b[axis])===0)return [Object.freeze({u:b.u,v:b.v})];}
 const boundary=c.sharing.boundary,use=e.boundaryUses[0];
 if(use){const old=boundary.edges[use.edge]!,curve=[boundary.domain.outer,...boundary.domain.holes][old.ring]![old.curve]!,span=nurbsCurveSpans3(curve).find(s=>s.index===old.span)!,ts=nurbsBoundaryCoordinateRoots3(span,axis==='u'?'x':'y',at);if(ts===null)return null;return ts.filter(t=>between(t,use.lower,use.upper)).map(t=>{const q=evaluateNurbsSpanPoint3(span,t);return Object.freeze({u:q.x,v:q.y});});}
 const R=c.source,u=e.intersectionUses[0]!;
 if(axis==='u'){const q=refinedNurbsAffineIntersectionEdgePoint3(R,u.edge,at);return [Object.freeze({u:q.u,v:q.v})];}
 const re=R.edges[u.edge]!,old=R.source.edges[re.sourceEdge]!,tp=R.source.source.patches[old.uses[0]!.patch]!,te=tp.edges[old.uses[0]!.edge]!,raw=R.source.source.source.patches[tp.sourceIntersectionPatch]!.edges[te.sourceEdge]!;
 if(raw.graph.edges[raw.sourceEdge]!.kind==='vertical'){const q=refinedNurbsAffineIntersectionEdgePoint3(R,u.edge,at);return [Object.freeze({u:q.u,v:q.v})];}
 const roots=bivariateFiberRoots(raw.graph.nonvertical.transpose(),at);if(roots.kind==='whole')return null;const points:UV[]=[];
 for(const x of roots.roots)if(between(x,u.lower,u.upper)){const q=refinedNurbsAffineIntersectionEdgePoint3(R,u.edge,x);if(q.v.compare(at)===0)points.push(Object.freeze({u:q.u,v:q.v}));}return points;
}
