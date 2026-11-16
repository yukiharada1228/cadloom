import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedNurbsPlaneSection3,nurbsPlaneSectionEdgePoint3} from './nurbs-plane-section3.js';
import type {NurbsPlaneSection3} from './nurbs-plane-section3.js';
import {nurbsPlaneSectionEdgeDifferential3} from './nurbs-section-differential3.js';
import type {NurbsSectionEdgeDifferential3} from './nurbs-section-differential3.js';

/** Oriented positive-width parameter interval of one owned implicit section
 * edge. This is not a certificate of a nonconstant or embedded spatial image. */
export interface NurbsSectionArc3 {
 readonly section:NurbsPlaneSection3;readonly piece:number;readonly edge:number;
 /** Source graph coordinate, not a normalized [0,1] traversal parameter. */
 readonly coordinate:'u'|'v';readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;
 readonly direction:1|-1;readonly start:AlgebraicCoordinates3;readonly end:AlgebraicCoordinates3;
}
const owned=new WeakSet<NurbsSectionArc3>(),real=(p:AlgebraicReal|ExactInput)=>p instanceof AlgebraicReal?p:AlgebraicReal.fromRational(p);
function guard(arc:NurbsSectionArc3):void {if(!owned.has(arc))throw new RangeError('Operation requires a factory-created NURBS section arc');}
function finish(arc:NurbsSectionArc3):NurbsSectionArc3 {const value=Object.freeze(arc);owned.add(value);return value;}
export function nurbsSectionArc3(section:NurbsPlaneSection3,piece:number,edge:number,lower?:AlgebraicReal|ExactInput,upper?:AlgebraicReal|ExactInput,direction:1|-1=1):NurbsSectionArc3 {
 assertOwnedNurbsPlaneSection3(section);if(direction!==1&&direction!==-1)throw new RangeError('Section arc direction must be +1 or -1');
 if(!Number.isSafeInteger(piece)||piece<0||piece>=section.pieces.length)throw new RangeError('Invalid section piece index');
 const t=section.pieces[piece]!.topology;if(!Number.isSafeInteger(edge)||edge<0||edge>=t.edges.length)throw new RangeError('Invalid section edge index');
 const e=t.edges[edge]!,coordinate=e.kind==='branch'?'u' as const:'v' as const,a=t.vertices[e.from]![coordinate],b=t.vertices[e.to]![coordinate],lo=lower===undefined?a:real(lower),hi=upper===undefined?b:real(upper);
 if(lo.compare(hi)>=0)throw new RangeError('Section arc parameter interval must have positive width');
 if(lo.compare(a)<0||hi.compare(b)>0)throw new RangeError('Section arc interval is outside its source edge');
 const A=nurbsPlaneSectionEdgePoint3(section,piece,edge,lo),B=nurbsPlaneSectionEdgePoint3(section,piece,edge,hi);
 return finish({section,piece,edge,coordinate,lower:lo,upper:hi,direction,start:direction===1?A:B,end:direction===1?B:A});
}
function checkedParameter(arc:NurbsSectionArc3,parameter:AlgebraicReal|ExactInput):AlgebraicReal {
 guard(arc);const t=real(parameter);if(t.compare(arc.lower)<0||t.compare(arc.upper)>0)throw new RangeError('Parameter is outside the section arc');return t;
}
export function nurbsSectionArcPoint3(arc:NurbsSectionArc3,parameter:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 const t=checkedParameter(arc,parameter);return nurbsPlaneSectionEdgePoint3(arc.section,arc.piece,arc.edge,t);
}
/** Derivatives retain their explicit local coordinate; reversal affects arc
 * traversal, not the mathematical meaning of increasing that coordinate. */
export function nurbsSectionArcDifferential3(arc:NurbsSectionArc3,parameter:AlgebraicReal|ExactInput):NurbsSectionEdgeDifferential3 {
 const t=checkedParameter(arc,parameter);return nurbsPlaneSectionEdgeDifferential3(arc.section,arc.piece,arc.edge,t);
}
export function reverseNurbsSectionArc3(arc:NurbsSectionArc3):NurbsSectionArc3 {
 guard(arc);return finish({...arc,direction:arc.direction===1?-1:1,start:arc.end,end:arc.start});
}
export function restrictNurbsSectionArc3(arc:NurbsSectionArc3,lower:AlgebraicReal|ExactInput,upper:AlgebraicReal|ExactInput):NurbsSectionArc3 {
 guard(arc);const lo=real(lower),hi=real(upper);if(lo.compare(arc.lower)<0||hi.compare(arc.upper)>0)throw new RangeError('Restriction is outside the section arc');return nurbsSectionArc3(arc.section,arc.piece,arc.edge,lo,hi,arc.direction);
}
/** Endpoints and repeated cuts are harmless; out-of-range cuts fail. Output is
 * ordered by traversal, while each fragment retains increasing source bounds. */
export function splitNurbsSectionArc3(arc:NurbsSectionArc3,input:readonly (AlgebraicReal|ExactInput)[]):readonly NurbsSectionArc3[] {
 guard(arc);const values=[arc.lower,arc.upper,...Array.from(input,real)];for(const t of values)if(t.compare(arc.lower)<0||t.compare(arc.upper)>0)throw new RangeError('Cut is outside the section arc');
 const sorted=values.sort((a,b)=>a.compare(b)).filter((p,i,a)=>i===0||p.compare(a[i-1]!)!==0),parts=sorted.slice(0,-1).map((p,i)=>nurbsSectionArc3(arc.section,arc.piece,arc.edge,p,sorted[i+1]!,arc.direction));
 return Object.freeze(arc.direction===1?parts:parts.reverse());
}
