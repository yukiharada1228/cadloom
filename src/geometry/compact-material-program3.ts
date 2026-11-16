import {assertOwnedCylinderMaterialProgram3,prepareCylinderMaterialProgram3} from './cylinder-material-program3.js';
import type {CylinderMaterialProgram3,CylinderMaterialExpression3} from './cylinder-material-program3.js';
import type {FiniteCylinder3} from './finite-cylinder-boolean3.js';
import type {Plane3} from './plane3.js';

const cache=new WeakMap<CylinderMaterialProgram3,CylinderMaterialProgram3>();
/** Equal coefficients up to a positive factor define the same strict halfspace.
 * A negative factor must never share its Boolean variable. */
function planeKey(p:Plane3):string {
 const n=p.normal,k=[n.x,n.y,n.z].find(q=>q.sign()!==0)!,scale=k.sign()<0?k.neg():k;
 return [n.x,n.y,n.z,p.offset].map(q=>q.div(scale).toString()).join(',');
}
/** Deliberately structural: geometrically equal reparameterized axes need not
 * merge. Identical finite specifications always denote the same primitive. */
function cylinderKey(p:FiniteCylinder3):string {
 const c=p.cylinder,o=c.axis.origin,d=c.axis.direction;
 return [o.x,o.y,o.z,d.x,d.y,d.z,c.radiusSquared,p.lower,p.upper].map(q=>q.toString()).join(',');
}
interface Node {readonly id:number;readonly expression:CylinderMaterialExpression3;}
/** Exact support interning and elementary Boolean identities. No epsilon,
 * sampled equivalence, distributive expansion or global equivalence solver.
 * The returned program owns its new primitive indices; old indices are invalid. */
export function compactCylinderMaterialProgram3(source:CylinderMaterialProgram3):CylinderMaterialProgram3 {
 assertOwnedCylinderMaterialProgram3(source);const known=cache.get(source);if(known)return known;
 const cylinders:FiniteCylinder3[]=[],planes:Plane3[]=[],cylinderIds=new Map<string,number>(),planeIds=new Map<string,number>();
 const intern=<T>(values:readonly T[],key:(v:T)=>string,table:T[],ids:Map<string,number>)=>values.map(value=>{const k=key(value),old=ids.get(k);if(old!==undefined)return old;const id=table.length;table.push(value);ids.set(k,id);return id;});
 const cs=intern(source.cylinders,cylinderKey,cylinders,cylinderIds),ps=intern(source.planes,planeKey,planes,planeIds);
 let next=1;const nodes=new Map<string,Node>(),memo=new WeakMap<CylinderMaterialExpression3,Node>();
 const no:Node={id:0,expression:{kind:'difference',first:{kind:'cylinder',cylinder:0},second:{kind:'cylinder',cylinder:0}}};
 const node=(key:string,expression:CylinderMaterialExpression3):Node=>{const old=nodes.get(key);if(old)return old;const value={id:next++,expression};nodes.set(key,value);return value;};
 const visit=(t:CylinderMaterialExpression3):Node=>{
  const old=memo.get(t);if(old)return old;let result:Node;
  if(t.kind==='cylinder')result=node(`c${cs[t.cylinder]!}`,{kind:'cylinder',cylinder:cs[t.cylinder]!});
  else if(t.kind==='halfspace')result=node(`p${ps[t.halfspace]!}`,{kind:'halfspace',halfspace:ps[t.halfspace]!});
  else {
   let a=visit(t.first),b=visit(t.second);
   if(a.id===b.id)result=t.kind==='union'||t.kind==='intersection'?a:no;
   else if(a.id===0)result=t.kind==='union'||t.kind==='xor'?b:no;
   else if(b.id===0)result=t.kind==='intersection'?no:a;
   else {if(t.kind!=='difference'&&a.id>b.id)[a,b]=[b,a];result=node(`${t.kind}:${a.id}:${b.id}`,{kind:t.kind,first:a.expression,second:b.expression});}
  }
  memo.set(t,result);return result;
 };
 const expression=visit(source.expression).expression;
 // Drop unused supports only after rewriting the entire formula. The explicit
 // false formula keeps a harmless cylinder carrier required by the schema.
 const usedC=new Map<number,number>(),usedP=new Map<number,number>(),outC:FiniteCylinder3[]=[],outP:Plane3[]=[];
 const remap=(t:CylinderMaterialExpression3):CylinderMaterialExpression3=>{
  if(t.kind==='cylinder'){let id=usedC.get(t.cylinder);if(id===undefined){id=outC.length;usedC.set(t.cylinder,id);outC.push(cylinders[t.cylinder]!);}return {kind:t.kind,cylinder:id};}
  if(t.kind==='halfspace'){let id=usedP.get(t.halfspace);if(id===undefined){id=outP.length;usedP.set(t.halfspace,id);outP.push(planes[t.halfspace]!);}return {kind:t.kind,halfspace:id};}
  return {kind:t.kind,first:remap(t.first),second:remap(t.second)};
 };
 const rewritten=remap(expression);
 if(!outC.length)outC.push(cylinders[0]!);
 const result=prepareCylinderMaterialProgram3(outC,outP,rewritten);cache.set(source,result);cache.set(result,result);return result;
}
