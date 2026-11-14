import {booleanCurveRegions2,circle2,fullCircleArc2,point2} from '../dist/index.js';
import type {CurveRegion2} from '../dist/index.js';
const disk=(x:bigint):CurveRegion2=>[[{kind:'arc',arc:fullCircleArc2(circle2(point2(x,0n),1n))}]];
const left=disk(0n),right=disk(1n);
const lens=booleanCurveRegions2(left,right,'intersection');
const crescent=booleanCurveRegions2(left,lens.rings,'difference');
const restored=booleanCurveRegions2(crescent.rings,lens.rings,'union','nonzero');
console.log({
  lensRings:lens.rings.length,
  lensPrimitives:lens.rings.flat().map(c=>c.kind),
  lensCenter:lens.locate(point2('1/2',0n)),
  crescentLeft:crescent.locate(point2('-1/2',0n)),
  crescentRight:crescent.locate(point2('1/2',0n)),
  restoredCenter:restored.locate(point2(0n,0n)),
  restoredRim:restored.locate(point2(1n,0n)),
});
