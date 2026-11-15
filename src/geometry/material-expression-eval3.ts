import type {CylinderMaterialExpression3} from './cylinder-material-expression3.js';
/** Internal evaluation of a factory-normalized material AST on strict side predicates. */
export function evaluateCylinderMaterialExpression3(t:CylinderMaterialExpression3,c:readonly boolean[],p:readonly boolean[]):boolean {
 if(t.kind==='cylinder')return c[t.cylinder]!;
 if(t.kind==='halfspace')return p[t.halfspace]!;
 const a=evaluateCylinderMaterialExpression3(t.first,c,p),b=evaluateCylinderMaterialExpression3(t.second,c,p);
 switch(t.kind){case 'union':return a||b;case 'intersection':return a&&b;case 'difference':return a&&!b;case 'xor':return a!==b;}
}
