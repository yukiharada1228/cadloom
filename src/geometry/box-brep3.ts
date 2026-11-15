import {exactRational} from '../numeric/polynomial.js';
import type {ExactInput} from './point2.js';
import {point2} from './point2.js';
import {point3} from './point3.js';
import type {Point3} from './point3.js';
import {extrudeCurveRegionBRep3} from './extruded-brep3.js';
import type {ExtrudedBRep3} from './extruded-brep3.js';

/** Independently constructed axis-aligned analytic box; all dimensions positive. */
export function buildBoxBRep3(inputOrigin:Point3,width:ExactInput,depth:ExactInput,height:ExactInput):Readonly<{origin:Point3;size:Point3;solid:ExtrudedBRep3}> {
  const origin=point3(inputOrigin.x,inputOrigin.y,inputOrigin.z),size=point3(exactRational(width),exactRational(depth),exactRational(height));if([size.x,size.y,size.z].some(x=>x.sign()<=0))throw new RangeError('Box dimensions must be positive');
  const x=origin.x,y=origin.y,X=x.add(size.x),Y=y.add(size.y),points=[point2(x,y),point2(X,y),point2(X,Y),point2(x,Y)],solid=extrudeCurveRegionBRep3([points.map((start,i)=>({kind:'segment',segment:{start,end:points[(i+1)%4]!}}))],size.z,{baseZ:origin.z});
  return Object.freeze({origin,size,solid});
}
