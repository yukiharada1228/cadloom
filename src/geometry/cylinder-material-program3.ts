import {evaluateCylinderMaterialExpression3} from './material-expression-eval3.js';
import {classifyPointToSurface3} from './surface3.js';
import type {Point3} from './point3.js';
import {assertOwnedFiniteCylinder3} from './finite-cylinder-boolean3.js';
import type {FiniteCylinder3} from './finite-cylinder-boolean3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import type {BooleanOperation} from './polygon-boolean.js';
export type CylinderMaterialExpression3=
 | {readonly kind:'cylinder';readonly cylinder:number}
 | {readonly kind:'halfspace';readonly halfspace:number}
 | {readonly kind:BooleanOperation;readonly first:CylinderMaterialExpression3;readonly second:CylinderMaterialExpression3};

/** Immutable bounded material definition, without combined boundary construction. */
export interface CylinderMaterialProgram3 {
 readonly cylinders:readonly FiniteCylinder3[];
 readonly planes:readonly Plane3[];
 readonly expression:CylinderMaterialExpression3;
}
const owned=new WeakSet<CylinderMaterialProgram3>();
export function assertOwnedCylinderMaterialProgram3(input:CylinderMaterialProgram3):void {
 if(!owned.has(input))throw new RangeError('Expected a factory-created cylinder material program');
}
function snapshot(t:CylinderMaterialExpression3,n:number,m:number,active=new Set<object>()):CylinderMaterialExpression3 {
 if(t===null||typeof t!=='object'||active.has(t))throw new RangeError('Invalid or cyclic cylinder material expression');active.add(t);let result:CylinderMaterialExpression3;
 if(t.kind==='cylinder'){if(!Number.isSafeInteger(t.cylinder)||t.cylinder<0||t.cylinder>=n)throw new RangeError('Invalid material cylinder index');result=Object.freeze({kind:t.kind,cylinder:t.cylinder});}
 else if(t.kind==='halfspace'){if(!Number.isSafeInteger(t.halfspace)||t.halfspace<0||t.halfspace>=m)throw new RangeError('Invalid material halfspace index');result=Object.freeze({kind:t.kind,halfspace:t.halfspace});}
 else {if(!['union','intersection','difference','xor'].includes(t.kind))throw new RangeError('Unknown material expression operation');result=Object.freeze({kind:t.kind,first:snapshot(t.first,n,m,active),second:snapshot(t.second,n,m,active)});}active.delete(t);return result;
}
/** Conservative Boolean range with every cylinder false and all planes unknown.
 * False upper bound proves that the material is bounded by the cylinder union.
 * Compositions of bounded operands always retain that certificate. */
function exterior(t:CylinderMaterialExpression3):{lo:boolean;hi:boolean} {if(t.kind==='cylinder')return {lo:false,hi:false};if(t.kind==='halfspace')return {lo:false,hi:true};const a=exterior(t.first),b=exterior(t.second);switch(t.kind){case 'union':return {lo:a.lo||b.lo,hi:a.hi||b.hi};case 'intersection':return {lo:a.lo&&b.lo,hi:a.hi&&b.hi};case 'difference':return {lo:a.lo&&!b.hi,hi:a.hi&&!b.lo};case 'xor':return {lo:a.lo&&!b.hi||!a.hi&&b.lo,hi:a.hi&&!b.lo||!a.lo&&b.hi};}}

export function prepareCylinderMaterialProgram3(input:readonly FiniteCylinder3[],inputPlanes:readonly Plane3[],tree:CylinderMaterialExpression3):CylinderMaterialProgram3 {
 if(!input.length)throw new RangeError('At least one finite cylinder is required');
 for(const cylinder of input)assertOwnedFiniteCylinder3(cylinder);
 const cylinders=Object.freeze(Array.from(input));
 const planes=Object.freeze(Array.from(inputPlanes,p=>plane3(p.normal.x,p.normal.y,p.normal.z,p.offset)));
 const expression=snapshot(tree,cylinders.length,planes.length);
 if(exterior(expression).hi)throw new RangeError('Material expression is not certified bounded by its finite cylinders');
 const result=Object.freeze({cylinders,planes,expression});owned.add(result);return result;
}

/** Strict witness classification. Primitive support zeros require another witness. */
export function strictCylinderMaterialProgramLocation3(source:CylinderMaterialProgram3,p:Point3):'inside'|'outside'|null {
 assertOwnedCylinderMaterialProgram3(source);
 const cylinders=source.cylinders.map(c=>c.locate(p)),planes=source.planes.map(plane=>classifyPointToSurface3(p,{kind:'plane',plane}));
 if(cylinders.includes('boundary')||planes.includes(0))return null;
 return evaluateCylinderMaterialExpression3(source.expression,cylinders.map(c=>c==='inside'),planes.map(s=>s<0))?'inside':'outside';
}

/** Compose complete local formulas; primitive identity sharing is optional,
 * never a geometric equivalence assumption. No boundary is constructed here. */
export function booleanCylinderMaterialPrograms3(a:CylinderMaterialProgram3,b:CylinderMaterialProgram3,operation:BooleanOperation):CylinderMaterialProgram3 {
 assertOwnedCylinderMaterialProgram3(a);assertOwnedCylinderMaterialProgram3(b);
 if(!['union','intersection','difference','xor'].includes(operation))throw new RangeError('Unknown material program operation');
 const remap=(t:CylinderMaterialExpression3,c:number,p:number):CylinderMaterialExpression3=>t.kind==='cylinder'?{kind:t.kind,cylinder:t.cylinder+c}:t.kind==='halfspace'?{kind:t.kind,halfspace:t.halfspace+p}:{kind:t.kind,first:remap(t.first,c,p),second:remap(t.second,c,p)};
 return prepareCylinderMaterialProgram3([...a.cylinders,...b.cylinders],[...a.planes,...b.planes],{kind:operation,first:a.expression,second:remap(b.expression,a.cylinders.length,a.planes.length)});
}
export function clipCylinderMaterialProgram3(source:CylinderMaterialProgram3,halfspaces:readonly import('./trimmed-cylinder3.js').CylinderHalfSpace3[]):CylinderMaterialProgram3 {
 assertOwnedCylinderMaterialProgram3(source);const planes=[...source.planes];let expression=source.expression;
 for(const h of halfspaces){
  if(h.side!==-1&&h.side!==1)throw new RangeError('Halfspace side must be -1 or 1');
  const p=h.plane,n=p.normal,plane=h.side===-1?plane3(n.x,n.y,n.z,p.offset):plane3(n.x.neg(),n.y.neg(),n.z.neg(),p.offset.neg()),halfspace=planes.length;
  planes.push(plane);expression={kind:'intersection',first:expression,second:{kind:'halfspace',halfspace}};
 }
 return prepareCylinderMaterialProgram3(source.cylinders,planes,expression);
}
