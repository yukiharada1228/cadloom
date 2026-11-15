import {surfacesCoincide3,normalToSurface3} from './surface3.js';
import type {Surface3} from './surface3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {reverseCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
import {sewBRepFaces3} from './sew-brep3.js';

/** Exact coorientation on coincident regular analytic supports. */
export function faceSupportsAgree3(a:Surface3,aSense:1|-1,b:Surface3,bSense:1|-1,sample:AlgebraicCoordinates3):boolean {
  if(!surfacesCoincide3(a,b))return false;const n=normalToSurface3(sample,a),m=normalToSurface3(sample,b),dot=n.x.mul(m.x).add(n.y.mul(m.y)).add(n.z.mul(m.z));return dot.sign()*aSense*bSense===1;
}
/** Complete oriented boundary-set matching after common endpoint noding.
 * The first boundary comes from a validated embedded analytic face domain.
 * This does not test intersections between different spatial face interiors.
 */
export function validateFaceBoundary3(surface:Surface3,sense:1|-1,expected:readonly (readonly Curve3[])[],actual:readonly (readonly Curve3[])[]):void {
  const reversed=actual.map(loop=>loop.slice().reverse().map(reverseCurve3));
  try {
    const sewn=sewBRepFaces3([{surface,sense,loops:expected},{surface,sense:sense===1?-1:1,loops:reversed}],{requireClosed:true}),t=sewn.topology;
    if(t.edges.some(e=>e.coedges.length!==2||t.coedges[e.coedges[0]!]!.face===t.coedges[e.coedges[1]!]!.face))throw new RangeError('Every boundary piece must pair one domain use with one serialized use');
  }
  catch(error){if(error instanceof RangeError)throw new RangeError(`Face boundary does not match its domain: ${error.message}`);throw error;}
}
