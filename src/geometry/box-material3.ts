import {prepareCylinderMaterialProgram3} from './cylinder-material-program3.js';
import type {CylinderMaterialProgram3} from './cylinder-material-program3.js';
import {exactRational} from '../numeric/polynomial.js';
import type {ExactInput} from './point2.js';
import {point3} from './point3.js';
import type {Point3} from './point3.js';
import {line3,cylinder3} from './surface3.js';
import {plane3} from './plane3.js';
import {prepareFiniteCylinder3} from './finite-cylinder-boolean3.js';
import {boundaryCylinderMaterialExpression3} from './cylinder-material-expression3.js';
import type {CylinderMaterialBoundary3,CylinderMaterialExpression3} from './cylinder-material-expression3.js';

/** Exact box in the bounded plane/cylinder material backend. The auxiliary
 * cylinder strictly contains the entire closed box and contributes no boundary. */
export function prepareBoxMaterialProgram3(inputOrigin:Point3,width:ExactInput,depth:ExactInput,height:ExactInput):CylinderMaterialProgram3 {
 const o=point3(inputOrigin.x,inputOrigin.y,inputOrigin.z),w=exactRational(width),d=exactRational(depth),h=exactRational(height);
 if([w,d,h].some(v=>v.sign()<=0))throw new RangeError('Box dimensions must be positive');
 // On the box, dx²+dy² <= w²+d² < radius² and both axial bounds
 // are strict. Thus conjunction with this guard leaves exactly six halfspaces.
 const one=exactRational(1n);
 const guard=prepareFiniteCylinder3(cylinder3(line3(point3(o.x,o.y,0n),point3(0n,0n,1n)),w.mul(w).add(d.mul(d)).add(one)),o.z.sub(one),o.z.add(h).add(one));
 const planes=[plane3(-1n,0n,0n,o.x),plane3(1n,0n,0n,o.x.add(w).neg()),plane3(0n,-1n,0n,o.y),plane3(0n,1n,0n,o.y.add(d).neg()),plane3(0n,0n,-1n,o.z),plane3(0n,0n,1n,o.z.add(h).neg())];
 let expression:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
 for(let i=0;i<planes.length;i++)expression={kind:'intersection',first:expression,second:{kind:'halfspace',halfspace:i}};
 return prepareCylinderMaterialProgram3([guard],planes,expression);
}

/** Legacy boundary entry retains its existing arrangement and face ordering. */
export function boundaryBoxMaterial3(origin:Point3,width:ExactInput,depth:ExactInput,height:ExactInput):CylinderMaterialBoundary3 {
 const p=prepareBoxMaterialProgram3(origin,width,depth,height);return boundaryCylinderMaterialExpression3(p.cylinders,p.planes,p.expression);
}
