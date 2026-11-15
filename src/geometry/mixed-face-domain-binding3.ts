import type {Surface3} from './surface3.js';
import {reverseBRepCurve3} from './brep-curve3.js';
import type {BRepCurve3} from './brep-curve3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';
/** Complete oriented boundary-set matching after common endpoint noding.
 * The first boundary comes from a validated embedded analytic face domain.
 * This does not test intersections between different spatial face interiors.
 */
export function validateMixedFaceBoundary3(surface:Surface3,sense:1|-1,expected:readonly (readonly BRepCurve3[])[],actual:readonly (readonly BRepCurve3[])[]):void {
  const reversed=actual.map(loop=>loop.slice().reverse().map(reverseBRepCurve3));
  try {
    const sewn=sewMixedBRepFaces3([{surface,sense,loops:expected},{surface,sense:sense===1?-1:1,loops:reversed}],{requireClosed:true}),t=sewn.topology;
    if(t.edges.some(e=>e.coedges.length!==2||t.coedges[e.coedges[0]!]!.face===t.coedges[e.coedges[1]!]!.face))throw new RangeError('Every boundary piece must pair one domain use with one serialized use');
  }
  catch(error){if(error instanceof RangeError)throw new RangeError(`Face boundary does not match its domain: ${error.message}`);throw error;}
}
