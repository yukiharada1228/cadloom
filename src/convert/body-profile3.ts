import {point2} from '../geometry/point2.js';
import {point3,vector3} from '../geometry/point3.js';
import {line2} from '../geometry/circle2.js';
import {lineInterval2} from '../geometry/line-interval2.js';
import {line3} from '../geometry/surface3.js';
import {lineInterval3,planarArc3,planeFrame3} from '../geometry/curve3.js';
import type {CurveRegion2} from '../geometry/curve-boolean2.js';
import {encodeCurveRecord3,decodeCurveRecord3} from './geometry3.js';
import type {CurveRecord3} from '../record/geometry3.js';
const xy=planeFrame3(point3(0n,0n,0n),vector3(1n,0n,0n),vector3(0n,1n,0n));
/** Records canonical line/arc profiles emitted by the extrusion constructor. */
export function encodeBodyProfile3(profile:CurveRegion2):readonly (readonly CurveRecord3[])[] {
  return Object.freeze(profile.map(ring=>Object.freeze(ring.map(c=>{
    if(c.kind==='line'){const l=c.interval.line;return encodeCurveRecord3({kind:'line',interval:lineInterval3(line3(point3(l.origin.x,l.origin.y,0n),vector3(l.direction.x,l.direction.y,0n)),c.interval.startParameter,c.interval.endParameter)});}
    if(c.kind==='arc')return encodeCurveRecord3({kind:'planar-arc',arc:planarArc3(xy,c.arc)});
    throw new RangeError('Body construction profiles must be canonical lines and arcs');
  }))));
}
export function decodeBodyProfile3(profile:readonly (readonly CurveRecord3[])[]):CurveRegion2 {
  return Object.freeze(profile.map(ring=>Object.freeze(ring.map(record=>{
    const c=decodeCurveRecord3(record);
    if(c.kind==='line'){
      const l=c.interval.line;if(l.origin.z.sign()!==0||l.direction.z.sign()!==0)throw new RangeError('Construction profile line must be in XY');
      return Object.freeze({kind:'line' as const,interval:lineInterval2(line2(point2(l.origin.x,l.origin.y),point2(l.direction.x,l.direction.y)),c.interval.startParameter,c.interval.endParameter)});
    }
    if(c.kind==='planar-arc'){
      const f=c.arc.frame;if(!f.origin.x.equals(xy.origin.x)||!f.origin.y.equals(xy.origin.y)||!f.origin.z.equals(xy.origin.z)||!f.u.x.equals(xy.u.x)||!f.u.y.equals(xy.u.y)||!f.u.z.equals(xy.u.z)||!f.v.x.equals(xy.v.x)||!f.v.y.equals(xy.v.y)||!f.v.z.equals(xy.v.z))throw new RangeError('Construction profile arc must use the canonical XY frame');
      return Object.freeze({kind:'arc' as const,arc:c.arc.arc});
    }
    throw new RangeError('Unsupported construction profile curve');
  }))));
}
