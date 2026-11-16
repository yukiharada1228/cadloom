import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import type {CurveRectangle2} from './algebraic-curve-topology2.js';
import {prepareNurbsDomainPolynomialPartition2} from './nurbs-domain-polynomial-partition2.js';
import {assertOwnedNurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
import type {NurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
/** Internal partition supports, finite endpoints and coordinate events. Actual
 * finite-face membership must still be queried on every selected stratum. */
export function prepareNurbsSourceFacePolynomialPartition3(source:Extract<NurbsSourceFacePatches3,{kind:'selected'}>) {
 assertOwnedNurbsSourceFacePatches3(source);const c=source.source.source.source.source,R=c.source,domain=prepareNurbsDomainPolynomialPartition2(c.sharing.boundary.domain),edges:BivariatePolynomial[]=[];
 const add=(p:BivariatePolynomial)=>{if((p.degreeU>0||p.degreeV>0)&&!edges.some(q=>q.equals(p)))edges.push(p);};
 for(const v of c.vertices){add(new BivariatePolynomial(v.u.recognizeRational().polynomial.coefficients.map(q=>[q])));add(new BivariatePolynomial([v.v.recognizeRational().polynomial.coefficients]));}
 for(const e of R.edges){const old=R.source.edges[e.sourceEdge]!,use=old.uses[0]!,p=R.source.source.patches[use.patch]!,t=p.edges[use.edge]!,raw=R.source.source.source.patches[p.sourceIntersectionPatch]!.edges[t.sourceEdge]!;add(raw.graph.polynomial);}
 return (bounds:CurveRectangle2):readonly BivariatePolynomial[]=>Object.freeze([...domain(bounds),...edges]);
}
