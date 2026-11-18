/** Public API of the display mesher (M2, upstream `solidcore-tess`). */
export {
  DEFAULT_CHORD_ZONES,
  DISPLAY_ANGLE_DEG,
  MAX_ANGLE_DEG,
  MIN_ANGLE_DEG,
  defaultMeshTolerance,
  meshRules,
  type MeshRules,
  type MeshTolerance,
} from './tolerance.ts';
export {
  MAX_BISECT_DEPTH,
  MAX_LINE_SEGMENTS,
  MAX_SEGMENTS,
  chordAngle,
  circleStepCount,
  curvePoints,
  sagitta,
  type CurveSamples,
} from './sample.ts';
export {
  MAX_TRIANGULATION_POINTS,
  Triangulation,
  bridgeHoles,
  earClip,
  loopOrientation,
  segmentsMeet,
  shoelace2,
  triangulatePolygon,
  type Tri,
} from './triangulate.ts';
export { MAX_GRID, meshFace, type FaceMesh } from './face.ts';
export { sampleEdge, tessellate, type EdgePolyline, type FaceRange, type Mesh, type MeshStats } from './mesh.ts';
export {
  isConsistentlyOriented,
  isWatertight,
  meshEdgeUseCounts,
  meshSignedVolume,
  meshTriangles,
  weldVertices,
  weldedTriangles,
  type EdgeUse,
} from './check.ts';
