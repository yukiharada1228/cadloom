export { Rational } from "./numeric/rational.js";
export type { Sign } from "./numeric/rational.js";
export { point2, segment2, pointsEqual, comparePoints } from "./geometry/point2.js";
export type { ExactInput, Point2, Segment2 } from "./geometry/point2.js";
export { orient2d } from "./geometry/orient2d.js";
export { intersectSegments, pointOnSegment } from "./geometry/segment-intersection.js";
export type { SegmentIntersection } from "./geometry/segment-intersection.js";
export { splitSegments } from "./geometry/split-segments.js";
export type { SplitVertex, SplitEdge, SegmentArrangement } from "./geometry/split-segments.js";
export { buildHalfEdges, compareDirections } from "./geometry/half-edges.js";
export type { HalfEdge, BoundaryWalk, HalfEdgeArrangement } from "./geometry/half-edges.js";
export { buildFaces } from "./geometry/faces.js";
export type { ArrangementFace, FaceArrangement } from "./geometry/faces.js";
export { booleanPolygons } from "./geometry/polygon-boolean.js";
export type { PolygonRegion, BooleanOperation, FillRule, PolygonBooleanResult } from "./geometry/polygon-boolean.js";
export { preparePolygon, locatePointInPolygon } from "./geometry/polygon-location.js";
export type { PointLocation, PreparedPolygon } from "./geometry/polygon-location.js";
export { affine2, affineDeterminant, transformPoint, transformSegment, transformPolygon, composeAffine2, invertAffine2 } from "./geometry/affine2.js";
export type { Affine2 } from "./geometry/affine2.js";
export { triangulatePolygon } from "./geometry/triangulate.js";
export type { PolygonMesh } from "./geometry/triangulate.js";
export { inspectMesh } from "./geometry/mesh3.js";
export type { TriangleIndices, TriangleMesh3, MeshInspection } from "./geometry/mesh3.js";
export { extrudePolygon } from "./geometry/extrude.js";
export type { ExtrudeOptions, ExtrudedMesh } from "./geometry/extrude.js";
export { point3, vector3, segment3, pointsEqual3, subtract3, dot3, cross3 } from "./geometry/point3.js";
export type { Point3, Vector3, Segment3 } from "./geometry/point3.js";
export { orient3d } from "./geometry/orient3d.js";
export { plane3, planeFromPoints, evaluatePlane3, classifyPointToPlane3, intersectSegmentPlane } from "./geometry/plane3.js";
export type { Plane3, SegmentPlaneIntersection } from "./geometry/plane3.js";
export { triangle3, pointOnTriangle3, intersectTrianglePlane, splitTriangleByPlane } from "./geometry/triangle3.js";
export type { Triangle3, TrianglePlaneIntersection, TrianglePlaneSplit } from "./geometry/triangle3.js";
export { buildTriangleTopology } from "./geometry/triangle-topology.js";
export type { TriangleTopology, TopologyHalfEdge3, TopologyEdge3, TopologyFace3, TriangleShell3, TopologyIssue3 } from "./geometry/triangle-topology.js";
export { intersectTriangles3, inspectTriangleEmbedding } from "./geometry/triangle-intersection3.js";
export type { TriangleTriangleIntersection, TriangleEmbeddingInspection, TriangleEmbeddingIssue } from "./geometry/triangle-intersection3.js";
export { prepareSolid3 } from './geometry/solid3.js';
export type { PreparedSolid3, SolidShell3 } from './geometry/solid3.js';
export { partitionTriangleByPlanes3 } from './geometry/triangle-plane-arrangement.js';
export type { TrianglePlaneCell3 } from './geometry/triangle-plane-arrangement.js';
export { booleanSolids3 } from './geometry/solid-boolean3.js';
export type { SolidBooleanResult3, SolidBooleanOperand3 } from './geometry/solid-boolean3.js';
export { Polynomial } from './numeric/polynomial.js';
export { AlgebraicReal, sturmSequence, countRealRoots, isolateRealRoots } from './numeric/real-roots.js';
export { algebraicPoint2, algebraicCoordinates2, compareAlgebraicPoints2, orientAlgebraicPoint2, orientAlgebraicPoints2 } from './geometry/algebraic-point2.js';
export type { AlgebraicPoint2, AlgebraicCoordinates2 } from './geometry/algebraic-point2.js';
export { circle2, circleThroughPoints2, line2, classifyPointToCircle2, classifyAlgebraicPointToCircle2, intersectLineCircle2, intersectSegmentCircle2, intersectCircles2 } from './geometry/circle2.js';
export type { Circle2, Line2, LineCircleHit2, CircleCircleIntersection2 } from './geometry/circle2.js';
export { polynomialResultant } from './numeric/resultant.js';
export { circularArc2, fullCircleArc2, reverseCircularArc2, comparePointsAroundCircle2, locatePointOnArc2, pointOnArc2, comparePointsOnArc2, splitCircularArc2, intersectLineArc2, intersectSegmentArc2, intersectArcs2 } from './geometry/circular-arc2.js';
export type { ArcDirection2, CircularPointInput2, CircularArcOptions2, CircularArc2, ArcPointLocation2, ArcIntersection2 } from './geometry/circular-arc2.js';
export { lineInterval2, pointOnLineInterval2, intersectLineIntervals2, intersectLineIntervalArc2 } from './geometry/line-interval2.js';
export type { LineInterval2, LineIntervalIntersection2 } from './geometry/line-interval2.js';
export { splitCurves2 } from './geometry/split-curves2.js';
export type { PlanarCurve2, CurveVertex2, CurveUse2, CurveEdge2, CurveArrangement2 } from './geometry/split-curves2.js';
export { buildCurveHalfEdges2 } from './geometry/curve-half-edges2.js';
export type { CurveGerm2, CurveHalfEdge2, CurveBoundaryWalk2, CurveHalfEdgeArrangement2 } from './geometry/curve-half-edges2.js';
export { buildCurveFaces2 } from './geometry/curve-faces2.js';
export type { CurveFace2, CurveFaceLocation2, CurveFaceArrangement2 } from './geometry/curve-faces2.js';
export { booleanCurveRegions2 } from './geometry/curve-boolean2.js';
export type { CurveBoundary2, CurveRegion2, CurveRegionLocation2, CurveBooleanResult2 } from './geometry/curve-boolean2.js';
export { algebraicCoordinates3, algebraicPoint3, compareAlgebraicPoints3 } from './geometry/algebraic-point3.js';
export type { AlgebraicCoordinates3, AlgebraicPoint3 } from './geometry/algebraic-point3.js';
export { line3, cylinder3, evaluateCylinder3, classifyPointToSurface3, normalToSurface3, intersectLineSurface3, intersectSegmentSurface3, surfacesCoincide3 } from './geometry/surface3.js';
export type { Line3, Cylinder3, Surface3, LineSurfaceHit3, LineSurfaceIntersection3, SegmentSurfaceIntersection3 } from './geometry/surface3.js';
export { planeFrame3, mapPlanePoint3, pointInPlaneFrame3, lineInterval3, planarArc3, curveEndpoints3, reverseCurve3, pointOnCurve3, curveOnSurface3, curveLoop3 } from './geometry/curve3.js';
export type { PlaneFrame3, LineInterval3, PlanarArc3, Curve3, CurveLoop3 } from './geometry/curve3.js';
export { circle3, circleThroughPoints3, circlePlane3, pointOnCircle3, circlesCoincide3, intersectLineCircle3, intersectSegmentCircle3, intersectCirclePlane3, intersectCircles3, comparePointsAroundCircle3, circularArc3, fullCircleArc3, reverseCircularArc3, locatePointOnArc3, pointOnArc3, comparePointsOnArc3, splitCircularArc3, intersectLineArc3, intersectSegmentArc3, intersectArcs3 } from './geometry/circle3.js';
export type { Circle3, CirclePointInput3, LineCircleHit3, CirclePlaneIntersection3, CircleCircleIntersection3, ArcDirection3, CircularArcOptions3, CircularArc3, ArcPointLocation3, ArcIntersection3 } from './geometry/circle3.js';
export { buildBRepTopology3 } from './geometry/brep-topology3.js';
export type { BRepEdgeUse3, BRepFaceInput3, BRepEdge3, BRepCoedge3, BRepLoop3, BRepFace3, BRepVertexLink3, BRepShell3, BRepIssue3, BRepTopology3 } from './geometry/brep-topology3.js';
export { preparePlanarFace3, prepareCircularFace3 } from './geometry/planar-face3.js';
export type { PlanarFaceDomain3, PreparedPlanarFace3 } from './geometry/planar-face3.js';
export { translateAlgebraicPoint3, subtractAlgebraicPoints3 } from './geometry/algebraic-point3.js';
export { algebraicSegment3, pointOnAlgebraicSegment3 } from './geometry/algebraic-segment3.js';
export type { AlgebraicSegment3 } from './geometry/algebraic-segment3.js';
export { interiorPointOnArc3 } from './geometry/circle3.js';
export { prepareCylinderFace3 } from './geometry/cylinder-face3.js';
export type { CylinderFaceOptions3, PreparedCylinderFace3 } from './geometry/cylinder-face3.js';
export { translateCurve3 } from './geometry/curve3.js';
export { prepareRectangleFace3, translatePlanarFace3 } from './geometry/planar-face3.js';
export { extrudeCurveRegionBRep3 } from './geometry/extruded-brep3.js';
export type { ExtrudeBRepOptions3, ExtrudedBRepFace3, ExtrudedBRep3 } from './geometry/extruded-brep3.js';
export { ellipse3, ellipsePlane3, pointOnEllipse3, locatePointInEllipse3, ellipsesCoincide3, intersectLineEllipse3, intersectSegmentEllipse3, ellipticArc3, fullEllipseArc3, reverseEllipticArc3, comparePointsAroundEllipse3, locatePointOnEllipticArc3, pointOnEllipticArc3, comparePointsOnEllipticArc3, splitEllipticArc3, intersectLineEllipticArc3, intersectSegmentEllipticArc3 } from './geometry/ellipse3.js';
export type { Ellipse3, LineEllipseHit3, EllipticArcOptions3, EllipticArc3 } from './geometry/ellipse3.js';
export { algebraicLine3, algebraicLinePoint3, pointOnAlgebraicLine3, algebraicLineOnSurface3 } from './geometry/algebraic-line3.js';
export type { AlgebraicLine3 } from './geometry/algebraic-line3.js';
export { intersectPlaneCylinder3 } from './geometry/plane-cylinder3.js';
export type { PlaneCylinderIntersection3 } from './geometry/plane-cylinder3.js';
export { intersectPlanes3 } from './geometry/plane3.js';
export type { PlanePlaneIntersection3 } from './geometry/plane3.js';
export { intersectEllipsePlane3 } from './geometry/ellipse3.js';
export type { EllipsePlaneIntersection3 } from './geometry/ellipse3.js';

export { interiorPointOnEllipticArc3 } from './geometry/ellipse3.js';
export { intersectPlaneCylinderFace3 } from './geometry/cylinder-face-section3.js';
export type { CylinderFaceSection3 } from './geometry/cylinder-face-section3.js';
export { intersectEllipses3 } from './geometry/ellipse3.js';
export type { EllipseEllipseIntersection3 } from './geometry/ellipse3.js';
export { intersectAlgebraicSegmentEllipse3 } from './geometry/ellipse3.js';
export { intersectPlanarCylinderFaces3 } from './geometry/planar-cylinder-intersection3.js';
export { splitCylinderFaceByPlane3 } from './geometry/cylinder-plane-split3.js';
export type { SplitCylinderRegion3, CylinderPlaneSplit3 } from './geometry/cylinder-plane-split3.js';
export { intersectAlgebraicSegmentPlane3 } from './geometry/algebraic-segment-plane3.js';
export type { AlgebraicSegmentPlaneIntersection3 } from './geometry/algebraic-segment-plane3.js';
export { prepareTrimmedCylinder3, splitTrimmedCylinderByPlane3, extractTrimmedCylinderComponent3 } from './geometry/trimmed-cylinder3.js';
export type { CylinderHalfSpace3, TrimmedCylinderComponent3, PreparedTrimmedCylinder3, TrimmedCylinderPlaneSplit3 } from './geometry/trimmed-cylinder3.js';
export { prepareEllipseFace3 } from './geometry/planar-face3.js';
export { prepareTrimmedPlanar3, splitTrimmedPlanarByPlane3 } from './geometry/trimmed-planar3.js';
export type { PlanarHalfSpace3, TrimmedPlanarComponent3, PreparedTrimmedPlanar3, TrimmedPlanarSplit3 } from './geometry/trimmed-planar3.js';
export { sewBRepFaces3 } from './geometry/sew-brep3.js';
export type { SewBRepFace3, SewBRepOptions3, SewnBRep3 } from './geometry/sew-brep3.js';
export { clipCylinderBRep3 } from './geometry/clipped-cylinder-brep3.js';
export type { ClippedCylinderFace3, ClippedCylinderBRep3 } from './geometry/clipped-cylinder-brep3.js';
export { splitClippedCylinderByPlane3, rejoinClippedCylinderSplit3 } from './geometry/clipped-cylinder-split3.js';
export type { CylinderSplitEdgeMap3, CylinderSplitInterface3, ClippedCylinderPlaneSplit3, RejoinedCylinderSplit3 } from './geometry/clipped-cylinder-split3.js';

export { nurbsCurve3, nurbsCurveSpans3, evaluateNurbsCurve3, derivativeNurbsCurve3, insertNurbsKnot3, splitNurbsCurve3, reverseNurbsCurve3, intersectNurbsPlane3 } from './geometry/nurbs-curve3.js';
export type { NurbsCurve3, NurbsSpan3, NurbsKnotSide3, NurbsPlanePoint3, NurbsPlaneIntersection3 } from './geometry/nurbs-curve3.js';

export { BivariatePolynomial } from './numeric/bivariate-polynomial.js';
export { nurbsSurface3, nurbsSurfacePatches3, evaluateNurbsSurface3, differentialNurbsSurface3, nurbsSurfaceIsoCurve3, insertNurbsSurfaceKnot3, splitNurbsSurface3, reverseNurbsSurface3, nurbsSurfacePlaneEquations3, nurbsSurfaceOnPlane3 } from './geometry/nurbs-surface3.js';
export type { NurbsDirection3, NurbsSurfaceSides3, NurbsSurface3, NurbsSurfacePatch3, NurbsSurfaceDifferential3, NurbsSurfaceSplit3 } from './geometry/nurbs-surface3.js';

export { divideBivariateExact, gcdBivariate, resultantBivariate, solveBivariateSystem } from './numeric/bivariate-system.js';
export type { BivariateRoot, BivariateSystemSolutions } from './numeric/bivariate-system.js';

export { bivariateFiberRoots } from './numeric/bivariate-system.js';
export type { BivariateFiberRoots } from './numeric/bivariate-system.js';
export { traceAlgebraicCurve2, traceAlgebraicCurveProduct2, evaluateAlgebraicCurveEdge2 } from './geometry/algebraic-curve-topology2.js';
export type { CurveRectangle2, CurveEvent2, AlgebraicCurveVertex2, AlgebraicCurveEdge2, AlgebraicCurveTopology2 } from './geometry/algebraic-curve-topology2.js';

export { intersectNurbsSurfacePlane3, nurbsPlaneSectionVertex3, nurbsPlaneSectionEdgePoint3 } from './geometry/nurbs-plane-section3.js';
export type { NurbsPlaneSection3 } from './geometry/nurbs-plane-section3.js';

export { sewNurbsPlaneSection3, nurbsSectionComplexEdgePoint3 } from './geometry/nurbs-section-seams3.js';
export type { NurbsSectionCell3, NurbsSectionSeam3, NurbsSectionVertexUse3, NurbsSectionComplexVertex3, NurbsSectionComplexEdge3, NurbsSectionComplex3 } from './geometry/nurbs-section-seams3.js';

export { solveBivariateEquations } from './numeric/bivariate-system.js';
export { intersectNurbsCurves3, evaluateNurbsCurveRelation3, nurbsCurveRelationEdgePoint3 } from './geometry/nurbs-curve-intersection3.js';
export type { NurbsCurvePairPoint3, NurbsCurveIntersectionPoint3, NurbsCurveParameterRelation3, NurbsCurveIntersection3 } from './geometry/nurbs-curve-intersection3.js';

export { analyzeNurbsCurve3 } from './geometry/nurbs-curve-analysis3.js';
export type { NurbsStationary3, NurbsCurveJoin3, NurbsRepeatWitness3, NurbsCurveAnalysis3 } from './geometry/nurbs-curve-analysis3.js';
export { prepareNurbsEdge3, reverseNurbsEdge3, buildNurbsBRepTopology3 } from './geometry/nurbs-edge3.js';
export type { PreparedNurbsEdge3 } from './geometry/nurbs-edge3.js';
export {liftNurbsSurfaceBoundary3,evaluateNurbsSurfaceBoundaryPiece3,nurbsSurfaceBoundaryMatchesCurve3} from './geometry/nurbs-surface-boundary3.js';
export type {NurbsSurfaceBoundary3,NurbsSurfaceBoundaryPiece3} from './geometry/nurbs-surface-boundary3.js';
export {prepareNurbsParameterDomain2} from './geometry/nurbs-parameter-domain2.js';
export type {PreparedNurbsParameterDomain2,NurbsDomainLocation2} from './geometry/nurbs-parameter-domain2.js';
export {analyzeNurbsSurfaceRegularity3} from './geometry/nurbs-surface-regularity3.js';
export type {NurbsSurfaceRegularity3,NurbsPatchRegularity3,NurbsSurfaceSingularPoint3,NurbsSurfaceSeam3} from './geometry/nurbs-surface-regularity3.js';
export {analyzeNurbsTrimRegularity3,evaluateNurbsTrimSingularEdge3} from './geometry/nurbs-trim-regularity3.js';
export type {NurbsTrimRegularity3,NurbsTrimPatchRegularity3,NurbsTrimSingularEdge3} from './geometry/nurbs-trim-regularity3.js';
export {analyzeNurbsTrimSeams3} from './geometry/nurbs-trim-seams3.js';
export type {NurbsTrimSeams3,NurbsTrimSeam3,NurbsTrimSeamState3,NurbsTrimSeamPoint3,NurbsTrimSeamInterval3} from './geometry/nurbs-trim-seams3.js';
export {encodeExactReal3,decodeExactReal3,encodeExactPoint3,decodeExactPoint3} from './convert/exact3.js';
export type {ExactRealRecord3,ExactPointRecord3,RationalPointRecord3} from './record/exact3.js';
export {encodeCurveRecord3,decodeCurveRecord3,encodeSurfaceRecord3,decodeSurfaceRecord3} from './convert/geometry3.js';
export type {FrameRecord3,CurveRecord3,SurfaceRecord3} from './record/geometry3.js';
export type {RecordCurveGeometry3,RecordSurfaceGeometry3} from './convert/geometry3.js';
export {readBodyRecord3,parseBodyRecord3,stringifyBodyRecord3} from './record/body3.js';
export {bodyRecordFromTopology3,decodeBodyGeometry3} from './convert/body3.js';
export type {BodyRecord3,BodyEdgeRecord3,BodyEdgeUseRecord3,BodyLoopRecord3,BodyFaceRecord3,BodyShellRecord3,BodyRegionRecord3} from './record/body3.js';
export type {DecodedBodyGeometry3} from './convert/body3.js';
export type {RecordReadLimits3} from './record/schema.js';
export {restoreNativeBRepBoundary3} from './convert/native-boundary3.js';
export type {NativeBRepBoundary3} from './convert/native-boundary3.js';
export {readBodyDocument3,parseBodyDocument3} from './record/body-document3.js';
export type {BodyDocument3,BodyConstructionRecord3} from './record/body-document3.js';
export {locateBody3,locateBodyFace3} from './model/body3.js';
export type {Body3} from './model/body3.js';
export {createBoxBody3,createCylinderBody3,extrudeBody3,bodyDocument3,serializeBody3,restoreBody3} from './ops/body3.js';
export {readFaceDomainRecord3} from './record/face-domain3.js';
export type {FaceDomainRecord3,PlanarDomainRecord3,CylinderDomainRecord3,CircleSupportRecord3,EllipseSupportRecord3,HalfSpaceRecord3} from './record/face-domain3.js';
export {encodePlanarDomain3,encodeCylinderDomain3,encodeTrimmedPlanarDomain3,encodeTrimmedCylinderDomain3,decodeFaceDomain3} from './convert/face-domain3.js';
export type {DecodedFaceDomain3} from './convert/face-domain3.js';
export {restoreNativeBRepFaces3} from './convert/native-faces3.js';
export type {NativeBRepFaces3} from './convert/native-faces3.js';

export {partitionConvexPolygonByPlanes3} from './geometry/convex-polygon-plane-arrangement3.js';
export type {ConvexPolygonPlaneCell3} from './geometry/convex-polygon-plane-arrangement3.js';
export {partitionPlanarBRepFaces3} from './geometry/planar-brep-partition3.js';
export type {PlanarBRepCell3,PlanarBRepEdgeOrigin3,PartitionedPlanarBRep3} from './geometry/planar-brep-partition3.js';
export {preparePlanarSolid3} from './geometry/planar-solid3.js';
export type {PreparedPlanarSolid3,PlanarSolidShell3} from './geometry/planar-solid3.js';
export {booleanPlanarSolids3} from './geometry/planar-solid-boolean3.js';
export type {PlanarSolidBooleanResult3,PlanarSolidBooleanOperand3,PlanarBooleanFaceSource3} from './geometry/planar-solid-boolean3.js';

export {createPlanarBody3,booleanPlanarBodies3} from './ops/body3.js';

export {consolidatePlanarSolid3} from './geometry/consolidate-planar-solid3.js';
export type {ConsolidatedPlanarSolid3} from './geometry/consolidate-planar-solid3.js';
export {consolidatePlanarBody3} from './ops/body3.js';
export type {ConsolidatedPlanarBody3} from './ops/body3.js';
export {createClippedCylinderBody3} from './ops/body3.js';
export {splitCylinderBodyByPlane3,rejoinCylinderBodySplit3} from './ops/cylinder-body-split3.js';
export type {CylinderBodyPlaneSplit3,RejoinedCylinderBodySplit3} from './ops/cylinder-body-split3.js';
export {intersectCylinders3,evaluateCylinderIntersectionArc3,pointOnCylinderIntersectionArc3} from './geometry/cylinder-cylinder3.js';
export type {CylinderCylinderIntersection3,CylinderIntersectionArc3,CylinderIntersectionGraph3} from './geometry/cylinder-cylinder3.js';
export {splitCylinderIntersectionArc3} from './geometry/cylinder-cylinder3.js';
export type {BoundedCylinderIntersection3} from './geometry/cylinder-cylinder3.js';
export {intersectCylinderIntersectionArcPlane3,splitCylinderIntersectionArcByPlane3,clipCylinderIntersectionByHalfspaces3} from './geometry/cylinder-intersection-plane3.js';
export type {CylinderIntersectionArcPlane3,CylinderIntersectionArcPlaneSplit3} from './geometry/cylinder-intersection-plane3.js';
export {cylinderIntersectionArcOnSurface3} from './geometry/cylinder-intersection-support3.js';
export {nativeBRepCurve3,cylinderIntersectionBRepCurve3,snapshotBRepCurve3,brepCurveEndpoints3,pointOnBRepCurve3,brepCurveOnSurface3,reverseBRepCurve3,buildMixedBRepTopology3} from './geometry/brep-curve3.js';
export type {BRepCurve3} from './geometry/brep-curve3.js';
export {sewMixedBRepFaces3} from './geometry/sew-mixed-brep3.js';
export type {MixedBRepFace3,SewnMixedBRep3,SewMixedBRepOptions3} from './geometry/sew-mixed-brep3.js';
export {clipCylinderIntersectionToFaces3} from './geometry/cylinder-intersection-face3.js';
export {partitionCylinderFaceByCylinder3,assertOwnedCylinderFaceCylinderPartition3} from './geometry/cylinder-face-cylinder-partition3.js';
export type {CylinderHeightBound3,CylinderFaceCell3,CylinderFaceCylinderPartition3} from './geometry/cylinder-face-cylinder-partition3.js';
export {partitionCylinderFaceCellsByPlane3,assertOwnedCylinderFacePlanePartition3} from './geometry/cylinder-cell-plane-partition3.js';
export type {CylinderFacePlanePartition3} from './geometry/cylinder-cell-plane-partition3.js';
export {partitionCylinderFaceByFiniteCylinder3,assertOwnedCylinderFaceFiniteCylinderPartition3} from './geometry/cylinder-face-finite-cylinder3.js';
export type {CylinderFaceFiniteCylinderPartition3} from './geometry/cylinder-face-finite-cylinder3.js';
export {partitionPlanarFaceByCylinders3,partitionPlanarFaceByCylinder3,assertOwnedPlanarFaceCylinderPartition3} from './geometry/planar-face-cylinder-partition3.js';
export type {PlanarVerticalBound3,PlanarCylinderFaceCell3,PlanarFaceCylinderPartition3} from './geometry/planar-face-cylinder-partition3.js';
export {partitionPlanarFaceByFiniteCylinder3,assertOwnedPlanarFaceFiniteCylinderPartition3} from './geometry/planar-face-finite-cylinder3.js';
export type {PlanarFaceFiniteCylinderPartition3} from './geometry/planar-face-finite-cylinder3.js';
export {prepareFiniteCylinder3,assertOwnedFiniteCylinder3,booleanFiniteCylinders3,assertOwnedFiniteCylinderBoolean3} from './geometry/finite-cylinder-boolean3.js';
export type {FiniteCylinder3,FiniteCylinderFaceSource3,FiniteCylinderBooleanFace3,FiniteCylinderBoolean3,FiniteCylinderOperandPartition3} from './geometry/finite-cylinder-boolean3.js';
export {encodeBRepCurveRecord3,decodeBRepCurveRecord3} from './convert/brep-curve3.js';
export type {BRepCurveRecord3,CylinderSupportRecord3} from './record/brep-curve3.js';

export {bodyRecordFromMixedTopology3} from './convert/body3.js';
export {restoreMixedBRepBoundary3} from './convert/mixed-boundary3.js';
export type {MixedBRepBoundary3} from './convert/mixed-boundary3.js';
export type {BodyCurveRecord3} from './record/body3.js';
export {encodePlanarMultiCellDomain3,encodeCylinderCellDomain3,decodeMixedFaceDomain3} from './convert/mixed-face-domain3.js';
export type {DecodedMixedFaceDomain3} from './convert/mixed-face-domain3.js';
export type {CylinderCellDomainRecord3} from './record/face-domain3.js';
export {restoreMixedBRepFaces3} from './convert/mixed-faces3.js';
export type {MixedBRepFaces3} from './convert/mixed-faces3.js';
export {encodePlanarCellDomain3} from './convert/mixed-face-domain3.js';
export type {PlanarMultiCellDomainRecord3,PlanarCellDomainRecord3} from './record/face-domain3.js';
export {bodyRecordFromFiniteCylinderBoolean3} from './convert/finite-cylinder-boolean3.js';
export {assertOwnedMixedBRepFaces3} from './convert/mixed-faces3.js';
export {intersectMixedBoundaryRay3,locatePointInMixedShell3} from './geometry/mixed-shell-ray3.js';
export type {MixedRayFaceUse3,MixedBoundaryRayHit3,MixedBoundaryRay3,MixedShellPointLocation3} from './geometry/mixed-shell-ray3.js';
export {intersectMixedBoundaryLine3} from './geometry/mixed-shell-ray3.js';
export {finiteCylinderBooleanRegions3} from './geometry/finite-cylinder-regions3.js';
export type {FiniteCylinderShellRegion3,FiniteCylinderBooleanRegions3} from './geometry/finite-cylinder-regions3.js';
export {createMixedFaceDomainDecoder3} from './convert/mixed-face-domain3.js';
export {bodyFromFiniteCylinderBoolean3,booleanCylinderBodies3} from './ops/body3.js';
export type {FiniteCylinderConstructionRecord3} from './record/body-document3.js';
export {intersectCylinderIntersectionArcCylinder3,splitCylinderIntersectionArcByCylinder3} from './geometry/cylinder-intersection-cylinder3.js';
export type {CylinderIntersectionArcCylinder3,CylinderIntersectionArcCylinderSplit3} from './geometry/cylinder-intersection-cylinder3.js';
export {refineCylinderFaceCells3,partitionCylinderFaceCellsByCylinder3,assertOwnedCylinderFaceRefinement3} from './geometry/cylinder-cell-refinement3.js';
export type {CylinderFaceRefinement3,CylinderFaceRefinementInput3} from './geometry/cylinder-cell-refinement3.js';
export {encodeRefinedCylinderCellDomain3} from './convert/mixed-face-domain3.js';
export type {RefinedCylinderCellDomainRecord3} from './record/face-domain3.js';

export {partitionPlanarFaceByFiniteCylinders3,assertOwnedPlanarFaceFiniteCylindersPartition3} from './geometry/planar-face-finite-cylinder3.js';
export type {PlanarFiniteCylinderCut3,PlanarFaceFiniteCylindersPartition3} from './geometry/planar-face-finite-cylinder3.js';
export {partitionCylinderFaceByFiniteCylinders3,assertOwnedCylinderFaceFiniteCylindersPartition3} from './geometry/cylinder-face-finite-cylinder3.js';
export type {CylinderFaceFiniteCylindersPartition3} from './geometry/cylinder-face-finite-cylinder3.js';
export {boundaryFiniteCylinderExpression3,assertOwnedFiniteCylinderExpressionBoundary3} from './geometry/finite-cylinder-expression3.js';
export type {FiniteCylinderExpression3,FiniteCylinderExpressionFace3,FiniteCylinderExpressionBoundary3} from './geometry/finite-cylinder-expression3.js';
export {bodyRecordFromFiniteCylinderExpression3} from './convert/finite-cylinder-expression3.js';
export {finiteCylinderExpressionRegions3} from './geometry/finite-cylinder-regions3.js';
export type {FiniteCylinderExpressionRegions3} from './geometry/finite-cylinder-regions3.js';
export {bodyFromFiniteCylinderExpression3} from './ops/body3.js';
export {locateFiniteCylinderExpression3} from './geometry/finite-cylinder-expression3.js';

export {sectionFiniteCylinderExpression3,assertOwnedCylinderExpressionPlaneSection3} from './geometry/cylinder-expression-plane-section3.js';
export type {CylinderExpressionSectionPatch3,CylinderExpressionPlaneSection3} from './geometry/cylinder-expression-plane-section3.js';

export {splitFiniteCylinderExpressionByPlane3,assertOwnedCylinderExpressionPlaneSplit3} from './geometry/cylinder-expression-plane-split3.js';
export type {CylinderExpressionSplitFaceOrigin3,CylinderExpressionSplitFace3,CylinderExpressionSplitChild3,CylinderExpressionSplitInterface3,CylinderExpressionPlaneSplit3} from './geometry/cylinder-expression-plane-split3.js';

export {bodyRecordFromCylinderExpressionSplit3} from './convert/cylinder-expression-split3.js';

export {finiteCylinderExpressionSplitRegions3} from './geometry/finite-cylinder-regions3.js';
export type {FiniteCylinderExpressionSplitRegions3} from './geometry/finite-cylinder-regions3.js';

export {bodyFromCylinderExpressionSplit3} from './ops/body3.js';

export {clipFiniteCylinderExpression3,refineClippedCylinderExpression3,assertOwnedClippedCylinderExpression3} from './geometry/clipped-cylinder-expression3.js';
export type {ClippedCylinderExpressionFaceOrigin3,ClippedCylinderExpressionFace3,ClippedCylinderExpression3} from './geometry/clipped-cylinder-expression3.js';

export {bodyRecordFromClippedCylinderExpression3} from './convert/clipped-cylinder-expression3.js';
export {clippedCylinderExpressionRegions3} from './geometry/finite-cylinder-regions3.js';
export type {ClippedCylinderExpressionRegions3} from './geometry/finite-cylinder-regions3.js';
export {bodyFromClippedCylinderExpression3,clipCylinderExpressionBody3} from './ops/body3.js';

export {boundaryCylinderMaterialExpression3,assertOwnedCylinderMaterialBoundary3,booleanCylinderMaterials3,clipCylinderMaterial3} from './geometry/cylinder-material-expression3.js';
export type {CylinderMaterialExpression3,CylinderMaterialFaceOrigin3,CylinderMaterialFace3,CylinderMaterialBoundary3,CylinderMaterialOperand3} from './geometry/cylinder-material-expression3.js';

export {bodyRecordFromCylinderMaterial3} from './convert/cylinder-material3.js';
export {cylinderMaterialRegions3} from './geometry/finite-cylinder-regions3.js';
export type {CylinderMaterialRegions3} from './geometry/finite-cylinder-regions3.js';
export {bodyFromCylinderMaterial3} from './ops/body3.js';

export {boundaryBoxMaterial3} from './geometry/box-material3.js';

export {booleanMixedBodies3} from './ops/body3.js';

export {boundaryConvexPlanarMaterial3} from './geometry/convex-planar-material3.js';

export {compilePlanarMaterial3} from './geometry/planar-material-program3.js';
export {boundaryPlanarMaterial3} from './geometry/planar-material-boundary3.js';
export type {PlanarMaterialProgram3} from './geometry/planar-material-program3.js';
export {compilePlanarChambers3} from './geometry/planar-material-chambers3.js';
export type {PlanarChamberProgram3} from './geometry/planar-material-chambers3.js';
export {planarVolumeMoments3} from './geometry/planar-volume-moments3.js';
export type {PlanarVolumeMoments3,RationalMatrix3} from './geometry/planar-volume-moments3.js';
export {planarBodyVolumeMoments3} from './ops/volume-moments3.js';

export {curveNodingPoints3,collectCurveNodingEvents3} from './geometry/curve-noding3.js';
export type {CurveNodingEvent3} from './geometry/curve-noding3.js';

export {partitionPlanarFaceByCurves3} from './geometry/planar-face-cylinder-partition3.js';
export type {PlanarCurveFaceCell3,PlanarFaceCurvePartition3} from './geometry/planar-face-cylinder-partition3.js';

export {surfaceGermSides3} from './geometry/surface-germ3.js';
export type {SurfaceGermSides3} from './geometry/surface-germ3.js';

export {classifyPlanarPartitionSurfaces3} from './geometry/planar-cell-surface3.js';
export type {PlanarCellSurfaceClassification3,PlanarPartitionSurfaceClassification3} from './geometry/planar-cell-surface3.js';

export {classifyPlanarPartitionMaterial3} from './geometry/planar-cell-material3.js';
export type {PlanarCellMaterialClassification3,PlanarPartitionMaterialClassification3} from './geometry/planar-cell-material3.js';

export {boundaryPlanarMaterialCells3} from './geometry/planar-material-cell-boundary3.js';
export type {PlanarMaterialCellBoundary3} from './geometry/planar-material-cell-boundary3.js';

export {refinePlanarMaterial3} from './geometry/refine-planar-material3.js';
export type {RefinedPlanarMaterial3} from './geometry/refine-planar-material3.js';

export {boundaryPlanarMaterialSurfaces3} from './geometry/planar-material-surfaces3.js';
export type {PlanarMaterialSupportOrigin3,PlanarMaterialSurface3,PlanarMaterialSurfaces3} from './geometry/planar-material-surfaces3.js';

export {classifyCylinderMaterialWall3,boundaryCylinderMaterialWall3,boundaryCylinderMaterialSurfaces3} from './geometry/cylinder-material-surfaces3.js';
export type {CylinderWallMaterialCell3,CylinderMaterialWallClassification3,CylinderMaterialWallBoundary3,CylinderMaterialSurfaces3} from './geometry/cylinder-material-surfaces3.js';

export {boundaryMaterialSurfaces3} from './geometry/material-surface-boundary3.js';
export type {MaterialSurfaceFaceOrigin3,MaterialSurfaceBoundaryOptions3,MaterialSurfaceBoundary3} from './geometry/material-surface-boundary3.js';

export {prepareCylinderMaterialProgram3,assertOwnedCylinderMaterialProgram3} from './geometry/cylinder-material-program3.js';
export type {CylinderMaterialProgram3} from './geometry/cylinder-material-program3.js';
export {materialProgramOfBoundary3} from './geometry/cylinder-material-expression3.js';
export type {CylinderMaterialDefinition3} from './geometry/cylinder-material-expression3.js';

export {encodePlanarCurveCellDomain3} from './convert/mixed-face-domain3.js';
export type {PlanarCurveCellDomainRecord3} from './record/face-domain3.js';
export {bodyRecordFromMaterialSurfaceBoundary3} from './convert/material-surface-boundary3.js';

export {materialSurfaceRegions3} from './geometry/finite-cylinder-regions3.js';
export type {MaterialSurfaceRegions3} from './geometry/finite-cylinder-regions3.js';
export {strictCylinderMaterialProgramLocation3} from './geometry/cylinder-material-program3.js';
export {locateMaterialSurfaceBoundary3} from './geometry/material-surface-boundary3.js';
export {bodyFromMaterialSurfaceBoundary3} from './ops/body3.js';
export {booleanCylinderMaterialPrograms3,clipCylinderMaterialProgram3} from './geometry/cylinder-material-program3.js';
export {booleanMaterialBodies3} from './ops/body3.js';
export {prepareBoxMaterialProgram3} from './geometry/box-material3.js';
export {preparePlanarMaterialProgram3} from './geometry/planar-material-boundary3.js';
export {prepareExtrudeMaterialProgram3} from './convert/circular-extrude-material3.js';
export {intersectBodyLine3,intersectBodyRay3} from './ops/body-query3.js';
export type {BodyBoundaryIntersection3} from './ops/body-query3.js';
export {intersectBodyLineMaterial3} from './ops/body-query3.js';
export type {BodyLineMaterialInterval3,BodyLineMaterialIntersection3} from './ops/body-query3.js';
export {similarityTransform3,transformPointBySimilarity3,transformVectorBySimilarity3} from './geometry/similarity3.js';
export type {SimilarityTransform3} from './geometry/similarity3.js';
export {transformCylinderMaterialProgram3} from './geometry/transform-material-program3.js';
export {transformBody3} from './ops/body-transform3.js';
export {composeSimilarityTransforms3,inverseSimilarityTransform3} from './geometry/similarity3.js';
export {closestPointOnLine3,closestPointOnSegment3,closestPointOnSurface3} from './geometry/closest-point3.js';
export type {UniqueClosestPoint3,LineClosestPoint3,SurfaceClosestPoint3} from './geometry/closest-point3.js';
export {closestPointOnCircle3,closestPointOnCircularArc3} from './geometry/closest-point3.js';
export type {CircleClosestPoint3,CircularArcClosestPoint3} from './geometry/closest-point3.js';
export {closestPointOnPlanarSolidBoundary3} from './geometry/closest-planar-solid3.js';
export type {PlanarBoundaryClosest3} from './geometry/closest-planar-solid3.js';
export {closestPointOnPlanarBodyBoundary3} from './ops/body-closest3.js';
export {createPlanarMaterial3,planarMaterialFromBody3,booleanPlanarMaterials3,locatePlanarMaterial3,planarBodyFromMaterial3,planarMaterialDocument3,serializePlanarMaterial3,restorePlanarMaterial3} from './ops/planar-material3.js';
export type {PlanarMaterial3,PlanarMaterialDocument3,PlanarMaterialNodeRecord3,PlanarMaterialReadLimits3} from './ops/planar-material3.js';

export {planarMaterialRegions3} from './ops/planar-material3.js';
export type {PlanarMaterialRegion3,PlanarMaterialBoundaryUse3,PlanarMaterialRegions3} from './geometry/planar-material-regions3.js';
export {readCellularBodyRecord3,parseCellularBodyRecord3} from './record/cellular-body3.js';
export type {CellularBoundaryRecord3,CellularRegionRecord3,CellularBodyRecord3} from './record/cellular-body3.js';
export {cellularBodyFromPlanarMaterial3,cellularBodyFromBody3,planarMaterialOfCellularBody3,locateCellularBody3,booleanCellularBodies3,cellularBodyDocument3,serializeCellularBody3,restoreCellularBody3} from './ops/cellular-body3.js';
export type {CellularBody3,CellularBodyDocument3,CellularBodyReadLimits3} from './ops/cellular-body3.js';

export {transformPlanarMaterial3} from './ops/planar-material3.js';
export type {BodyQuerySource3} from './ops/body-query3.js';
export {closestPointOnPlanarMaterialBoundary3,planarMaterialVolumeMoments3} from './ops/planar-material3.js';
export type {KernelBody3} from './model/body3.js';
export type {NurbsBody3,NurbsBodyRegion3} from './model/nurbs-body3.js';
export {bodyFromNurbsMaterial3} from './ops/nurbs-body3.js';
export {readNurbsBodyDocument3} from './record/nurbs-body3.js';
export type {NurbsBodyDocument3} from './record/nurbs-body3.js';
export type {KernelBodyDocument3,SerializedBody3,BodyReadLimits3} from './ops/body3.js';
export {materialProgramOfPlanarMaterial3} from './ops/planar-material3.js';
export type {MaterialBodyBooleanOptions3} from './ops/body3.js';
export {splitPlanarBodyByPlane3,rejoinPlanarBodySplit3} from './ops/planar-body-split3.js';
export type {PlanarBodyPlaneSplit3,PlanarBodySplitInterface3} from './ops/planar-body-split3.js';
export {planarBodySplitProvenance3} from './ops/planar-split-provenance3.js';
export type {PlanarBodySplitProvenance3,PlanarSplitChildProvenance3,SplitFaceOrigin3,SplitEdgeOrigin3,SplitCoedgeOrigin3,SplitVertexOrigin3,SplitParameterInterval3,SplitParentEdgeInterval3,SplitParentCoedgeInterval3} from './ops/planar-split-provenance3.js';
export {splitBodyByPlane3} from './ops/body-plane-split3.js';
export type {BodyPlaneSplit3} from './ops/body-plane-split3.js';
export {compactCylinderMaterialProgram3} from './geometry/compact-material-program3.js';
export {bodySplitInterface3} from './ops/body-split-interface3.js';
export type {BodySplitInterface3,BodySplitInterfaceCoedge3,BodySplitInterfaceAtom3} from './ops/body-split-interface3.js';
export {rejoinBodyPlaneSplit3} from './ops/rejoin-body-split3.js';
export type {RejoinedBodyPlaneSplit3} from './ops/rejoin-body-split3.js';
export {secondDifferentialNurbsSurface3} from './geometry/nurbs-surface3.js';
export type {NurbsSurfaceSecondDifferential3} from './geometry/nurbs-surface3.js';
export {curvatureNurbsSurface3} from './geometry/nurbs-surface-curvature3.js';
export type {NurbsSurfaceCurvature3} from './geometry/nurbs-surface-curvature3.js';
export {nurbsPlaneSectionEdgeDifferential3} from './geometry/nurbs-section-differential3.js';
export type {NurbsSectionEdgeDifferential3} from './geometry/nurbs-section-differential3.js';
export {nurbsSectionArc3,nurbsSectionArcPoint3,nurbsSectionArcDifferential3,reverseNurbsSectionArc3,restrictNurbsSectionArc3,splitNurbsSectionArc3} from './geometry/nurbs-section-arc3.js';
export type {NurbsSectionArc3} from './geometry/nurbs-section-arc3.js';
export {intersectNurbsSectionArcPlane3,splitNurbsSectionArcByPlane3} from './geometry/nurbs-section-arc-plane3.js';
export type {NurbsSectionArcPlaneIntersection3,NurbsSectionArcPlanePoint3,NurbsSectionArcPlaneSplit3} from './geometry/nurbs-section-arc-plane3.js';
export {partitionNurbsSectionArcByDomain3} from './geometry/nurbs-section-arc-domain3.js';
export type {NurbsSectionArcDomainPartition3} from './geometry/nurbs-section-arc-domain3.js';
export {intersectTrimmedNurbsSurfacePlane3,trimmedNurbsSectionEdgePoint3,trimmedNurbsSectionAreaPoint3} from './geometry/nurbs-trimmed-plane-section3.js';
export type {TrimmedNurbsPlaneSection3,TrimmedNurbsSectionVertex3,TrimmedNurbsSectionEdge3,TrimmedNurbsSectionArea3} from './geometry/nurbs-trimmed-plane-section3.js';
export {nurbsSurfacePointPreimages3,nurbsSurfacePreimageEdgePoint3,nurbsSurfacePreimagePatchPoint3} from './geometry/nurbs-surface-preimage3.js';
export type {NurbsSurfacePointPreimages3,NurbsSurfacePreimagePatch3} from './geometry/nurbs-surface-preimage3.js';
export {trimNurbsSurfacePointPreimages3,nurbsTrimmedSurfacePointPreimages3,trimmedNurbsSurfacePreimageEdgePoint3,trimmedNurbsSurfacePreimagePatchPoint3} from './geometry/nurbs-trimmed-surface-preimage3.js';
export type {TrimmedNurbsSurfacePointPreimages3,TrimmedNurbsPreimagePatch3,TrimmedNurbsPreimageVertex3} from './geometry/nurbs-trimmed-surface-preimage3.js';
export {certifyNurbsSurfaceAffineProjection3,nurbsAffineProjectionParameters3,locateAffineProjectedNurbsSurface3} from './geometry/nurbs-affine-projection3.js';
export type {NurbsAffineParameterRow3,NurbsAffineProjectionCertificate3,NurbsAffineProjectionResult3} from './geometry/nurbs-affine-projection3.js';
export {createAffineNurbsFace3,locateAffineNurbsFace3,affineNurbsFacePoint3,intersectAffineNurbsFacePlane3} from './geometry/affine-nurbs-face3.js';
export type {AffineNurbsFace3} from './geometry/affine-nurbs-face3.js';
export {sewAffineNurbsFaces3,affineNurbsBoundaryEdgePoint3} from './geometry/sew-affine-nurbs-faces3.js';
export type {AffineNurbsBoundaryEdge3,SewnAffineNurbsFaces3} from './geometry/sew-affine-nurbs-faces3.js';
export {readAffineNurbsFaceRecord3,readAffineNurbsFacesDocument3,parseAffineNurbsFacesDocument3} from './record/affine-nurbs-face3.js';
export type {AffineNurbsFaceRecord3,AffineNurbsFacesDocument3} from './record/affine-nurbs-face3.js';
export {encodeAffineNurbsFace3,decodeAffineNurbsFace3,affineNurbsFacesDocument3,serializeAffineNurbsFaces3,restoreAffineNurbsFaces3} from './convert/affine-nurbs-face3.js';
export {intersectAffineNurbsFaceBoundaries3,affineNurbsBoundaryRelationPoint3} from './geometry/affine-nurbs-boundary-intersection3.js';
export type {AffineNurbsBoundaryRef3,AffineNurbsBoundaryPairPoint3,AffineNurbsBoundaryRelation3,AffineNurbsBoundaryIntersection3} from './geometry/affine-nurbs-boundary-intersection3.js';
export {nurbsAffineIntersectionEquations3,nurbsAffineIntersectionContains3,nurbsAffineIntersectionPoint3} from './geometry/nurbs-affine-intersection-equations3.js';
export type {NurbsAffineIntersectionEquationPatch3,NurbsAffineIntersectionEquations3,NurbsAffineIntersectionPoint3} from './geometry/nurbs-affine-intersection-equations3.js';
export {solveNurbsAffineIntersectionEquations3,intersectNurbsSurfaceAffineTarget3,nurbsAffineIntersectionEdgePoint3,nurbsAffineIntersectionRegionPoint3} from './geometry/nurbs-affine-intersection3.js';
export type {NurbsAffineIntersectionEdge3,NurbsAffineIntersectionPatch3,NurbsAffineIntersection3} from './geometry/nurbs-affine-intersection3.js';
export {implicitizeNurbsParameterCurve2,implicitNurbsParameterSpanPoint2} from './geometry/nurbs-parameter-implicit2.js';
export type {ImplicitNurbsParameterSpan2,ImplicitNurbsParameterCurve2} from './geometry/nurbs-parameter-implicit2.js';
export {intersectAffineNurbsFaces3,trimNurbsAffineIntersection3,trimmedNurbsAffineIntersectionEdgePoint3,trimmedNurbsAffineIntersectionRegionPoint3} from './geometry/nurbs-affine-intersection-trim3.js';
export type {TrimmedNurbsAffineIntersectionPoint3,TrimmedNurbsAffineIntersectionEdge3,TrimmedNurbsAffineIntersectionPatch3,TrimmedNurbsAffineIntersection3} from './geometry/nurbs-affine-intersection-trim3.js';
export {sewNurbsAffineIntersection3,nurbsAffineIntersectionComplexEdgePoint3} from './geometry/nurbs-affine-intersection-seams3.js';
export type {NurbsIntersectionVertexUse3,NurbsIntersectionComplexVertex3,NurbsIntersectionComplexEdge3,NurbsAffineIntersectionComplex3} from './geometry/nurbs-affine-intersection-seams3.js';
export {nurbsAffineIntersectionEdgeDifferential3,trimmedNurbsAffineIntersectionEdgeDifferential3,nurbsAffineIntersectionComplexEdgeDifferential3} from './geometry/nurbs-affine-intersection-differential3.js';
export type {NurbsAffineIntersectionEdgeDifferential3,TrimmedNurbsAffineIntersectionEdgeDifferential3} from './geometry/nurbs-affine-intersection-differential3.js';
export {analyzeNurbsAffineIntersectionEdgeEvents3,analyzeTrimmedNurbsAffineIntersectionEdgeEvents3,analyzeNurbsAffineIntersectionComplexEdgeEvents3} from './geometry/nurbs-affine-intersection-events3.js';
export type {NurbsIntersectionDifferentialInterval3,NurbsIntersectionDifferentialEvents3,TrimmedNurbsIntersectionDifferentialEvents3,NurbsIntersectionComplexDifferentialEvents3} from './geometry/nurbs-affine-intersection-events3.js';
export {refineNurbsAffineIntersectionComplex3,refinedNurbsAffineIntersectionEdgePoint3,refinedNurbsAffineIntersectionEdgeDifferential3} from './geometry/nurbs-affine-intersection-refine3.js';
export type {RefinedNurbsIntersectionVertex3,RefinedNurbsIntersectionEdge3,RefinedNurbsAffineIntersectionComplex3} from './geometry/nurbs-affine-intersection-refine3.js';
export {nodeNurbsIntersectionBoundary3} from './geometry/nurbs-intersection-boundary-nodes3.js';
export type {NurbsIntersectionBoundaryVertex2,NurbsIntersectionBoundaryEdge2,NurbsIntersectionBoundaryNodes3} from './geometry/nurbs-intersection-boundary-nodes3.js';
export {matchNurbsIntersectionSourceBoundary3} from './geometry/nurbs-intersection-boundary-sharing3.js';
export type {NurbsSourceBoundarySharedInterval3,NurbsSourceBoundarySharing3} from './geometry/nurbs-intersection-boundary-sharing3.js';
export {buildNurbsSourceBoundaryComplex3} from './geometry/nurbs-source-boundary-complex3.js';
export type {NurbsSourceBoundaryComplexUse3,NurbsSourceBoundaryComplex3} from './geometry/nurbs-source-boundary-complex3.js';
export {buildNurbsSourceHalfedges3} from './geometry/nurbs-source-halfedges3.js';
export type {NurbsSourceHalfedge3,NurbsSourceHalfedges3} from './geometry/nurbs-source-halfedges3.js';
export {classifyNurbsSourceFaces3} from './geometry/nurbs-source-faces3.js';
export type {NurbsSourceFace3,NurbsSourceFaces3} from './geometry/nurbs-source-faces3.js';
export {locateNurbsSourceFace3} from './geometry/nurbs-source-face-location3.js';
export type {NurbsSourceFaceLocation3} from './geometry/nurbs-source-face-location3.js';
export {liftNurbsSourceFaceBoundaries3,evaluateNurbsSourceLiftPiece3} from './geometry/nurbs-source-face-lift3.js';
export type {NurbsSourceLiftEvent3,NurbsSourceLiftEdge3,NurbsSourceFaceLift3} from './geometry/nurbs-source-face-lift3.js';
export {selectNurbsSourceFacePatches3} from './geometry/nurbs-source-face-patches3.js';
export type {NurbsSourceFacePatchUse3,NurbsSourceFaceSeamInterval3,NurbsSourceFacePatchSelection3,NurbsSourceFacePatches3} from './geometry/nurbs-source-face-patches3.js';
export {analyzeNurbsSourceFaceInteriorRegularity3} from './geometry/nurbs-source-face-regularity3.js';
export type {NurbsSourceFacePatchRegularity3,NurbsSourceFaceRegularity3} from './geometry/nurbs-source-face-regularity3.js';
export {analyzeNurbsSourceFaceBoundaryRegularity3} from './geometry/nurbs-source-boundary-regularity3.js';
export type {NurbsSourceBoundaryRankEvent3,NurbsSourceBoundaryRankUse3,NurbsSourceBoundaryRegularity3} from './geometry/nurbs-source-boundary-regularity3.js';
export {analyzeNurbsSourceFaceVertexRegularity3} from './geometry/nurbs-source-vertex-regularity3.js';
export type {NurbsSourceVertexSector3,NurbsSourceVertexRankEvent3,NurbsSourceVertexRegularity3} from './geometry/nurbs-source-vertex-regularity3.js';
export {analyzeNurbsSourceFaceClosedRank3} from './geometry/nurbs-source-closed-rank3.js';
export type {NurbsSourceClosedRank3} from './geometry/nurbs-source-closed-rank3.js';
export {certifyNurbsSurfaceTriangularProjection3,evaluateNurbsTriangularSurface3} from './geometry/nurbs-triangular-projection3.js';
export type {NurbsTriangularProjectionCertificate3,NurbsTriangularProjectionResult3} from './geometry/nurbs-triangular-projection3.js';
export {certifyNurbsSourceFaceEmbedding3} from './geometry/nurbs-source-face-embedding3.js';
export type {NurbsSourceEmbeddedFace3,NurbsSourceFaceEmbedding3} from './geometry/nurbs-source-face-embedding3.js';
export {prepareNurbsSourceFaceComplex3,evaluateNurbsSourceComplexEdge3} from './geometry/nurbs-source-face-complex3.js';
export type {NurbsSourceFaceComplex3,NurbsSourceComplexVertex3,NurbsSourceComplexEdge3} from './geometry/nurbs-source-face-complex3.js';
export {evaluateNurbsSourceComplexFace3} from './geometry/nurbs-source-complex-face-query3.js';
export type {NurbsSourceComplexFacePoint3} from './geometry/nurbs-source-complex-face-query3.js';
export {nurbsSurfaceRectanglePointPreimages3} from './geometry/nurbs-surface-preimage3.js';
export {nurbsSourceComplexFacePointPreimage3} from './geometry/nurbs-source-complex-face-preimage3.js';
export type {NurbsSourceComplexFacePreimage3} from './geometry/nurbs-source-complex-face-preimage3.js';
export {buildNurbsSourceBRep3,nurbsSourceBRepEdgePoint3} from './geometry/nurbs-source-brep3.js';
export type {NurbsSourceBRep3,NurbsSourceBRepEdge3,NurbsSourceBRepFace3} from './geometry/nurbs-source-brep3.js';
export {readNurbsSourceBRepRecord3,parseNurbsSourceBRepRecord3} from './record/nurbs-source-brep3.js';
export type {NurbsSourceBRepRecord3,NurbsSourceDomainRecord3} from './record/nurbs-source-brep3.js';
export {encodeNurbsSourceBRep3,decodeNurbsSourceBRep3,stringifyNurbsSourceBRep3,restoreNurbsSourceBRep3} from './convert/nurbs-source-brep3.js';
export {intersectNurbsSourceFaceLine3,intersectNurbsSourceFaceRay3,nurbsSourceFaceLineOverlapPoint3} from './geometry/nurbs-source-face-line3.js';
export type {NurbsSourceFaceLine3,NurbsSourceLineVertex3,NurbsSourceLineOverlap3} from './geometry/nurbs-source-face-line3.js';
export {sewNurbsSourceBReps3,sewnNurbsSourceEdgePoint3} from './geometry/sew-nurbs-source-breps3.js';
export type {SewnNurbsSourceBReps3,SewnNurbsSourceEdge3,SewnNurbsSourceFace3} from './geometry/sew-nurbs-source-breps3.js';
export {intersectSewnNurbsSourceRay3,intersectSewnNurbsSourceLine3,querySewnNurbsSourceShellParity3} from './geometry/sewn-nurbs-source-ray3.js';
export type {SewnNurbsSourceRay3,SewnNurbsSourceRayUse3,SewnNurbsSourceRayReason3,SewnNurbsShellParity3} from './geometry/sewn-nurbs-source-ray3.js';
export {querySewnNurbsSourceShellParityAuto3} from './geometry/sewn-nurbs-source-parity-search3.js';
export type {SewnNurbsParitySearchOptions3,SewnNurbsShellParitySearch3} from './geometry/sewn-nurbs-source-parity-search3.js';
export {analyzeSewnNurbsSourceContainment3} from './geometry/sewn-nurbs-source-containment3.js';
export type {SewnNurbsShellContainmentNode3,SewnNurbsSourceContainmentCertificate3,SewnNurbsSourceContainment3} from './geometry/sewn-nurbs-source-containment3.js';
export {certifySewnNurbsSourceMaterial3} from './geometry/sewn-nurbs-source-material3.js';
export type {SewnNurbsShellOrientation3,SewnNurbsSourceMaterialCertificate3,SewnNurbsSourceMaterial3} from './geometry/sewn-nurbs-source-material3.js';
export {locateSewnNurbsSourceMaterial3} from './geometry/sewn-nurbs-source-material-query3.js';
export type {SewnNurbsMaterialLocation3} from './geometry/sewn-nurbs-source-material-query3.js';
export {intersectSewnNurbsSourceMaterialLine3} from './geometry/sewn-nurbs-source-material-line3.js';
export type {SewnNurbsMaterialLineHit3,SewnNurbsMaterialLineSpan3,SewnNurbsMaterialLineInterval3,SewnNurbsMaterialLine3} from './geometry/sewn-nurbs-source-material-line3.js';
export {certifySewnNurbsSourceEmbedding3} from './geometry/sewn-nurbs-source-embedding3.js';
export type {SewnNurbsSourceEmbedding3,SewnNurbsSourceEmbeddingCertificate3,NurbsSourceFaceSeparation3,NurbsSourceFaceSeparationHint3} from './geometry/sewn-nurbs-source-embedding3.js';

export {intersectNurbsSourceFacePlane3,nurbsSourceFacePlaneEdgePoint3,nurbsSourceFacePlaneAreaPoint3} from './geometry/nurbs-source-face-plane3.js';
export type {NurbsSourcePlaneVertex3,NurbsSourcePlaneEdge3,NurbsSourcePlaneArea3,NurbsSourceFacePlane3} from './geometry/nurbs-source-face-plane3.js';

export {intersectSewnNurbsSourceBoundaryPlane3,nurbsBoundaryPlaneEdgePoint3} from './geometry/sewn-nurbs-source-boundary-plane3.js';
export type {NurbsBoundaryPlaneVertex3,NurbsBoundaryPlaneEdge3,NurbsBoundaryPlaneComponent3,NurbsBoundaryPlaneDiagnostic3,SewnNurbsBoundaryPlane3} from './geometry/sewn-nurbs-source-boundary-plane3.js';
export {intersectNurbsBodyBoundaryPlane3} from './ops/nurbs-body-boundary-plane3.js';

export {certifyNurbsBoundaryPlaneWires3} from './geometry/nurbs-plane-wires3.js';
export type {NurbsPlaneWireEdge3,NurbsPlaneWire3,NurbsPlaneWiresCertificate3,NurbsPlaneWires3} from './geometry/nurbs-plane-wires3.js';

export {nurbsPlaneDomain3,locateNurbsPlaneDomain3,nurbsPlaneDomainEdgePoint3} from './geometry/nurbs-plane-domain3.js';
export type {NurbsPlaneDomain3} from './geometry/nurbs-plane-domain3.js';

export {partitionNurbsSourceFaceByPlane3,nurbsSourcePlaneCellPoint3} from './geometry/nurbs-source-plane-cells3.js';
export type {NurbsSourcePlaneCell3,NurbsSourcePlaneCells3} from './geometry/nurbs-source-plane-cells3.js';

export {nurbsSourcePlaneCellBoundary3,nurbsSourcePlaneCellBoundaryPoint3} from './geometry/nurbs-source-plane-cell-boundary3.js';
export type {NurbsSourcePlaneCellBoundary3,NurbsSourcePlaneCellBoundaryEdge3} from './geometry/nurbs-source-plane-cell-boundary3.js';

export {buildNurbsSourcePlaneCellComplex3,nurbsSourcePlaneCellComplexEdgePoint3} from './geometry/nurbs-source-plane-cell-complex3.js';
export type {NurbsSourcePlaneCellComplex3} from './geometry/nurbs-source-plane-cell-complex3.js';

export {refineSewnNurbsSourceEdgesByPlane3,refineNurbsSourcePlaneEdgeParameters3,nurbsSourcePlaneEdgeFragmentPoint3,nurbsSourcePlaneEdgeFragmentPointPreimages3} from './geometry/sewn-nurbs-source-edge-plane3.js';
export type {NurbsSourcePlaneEdgeFragment3,SewnNurbsSourceEdgePlane3,SewnNurbsSourceEdgeParameterRefinement3} from './geometry/sewn-nurbs-source-edge-plane3.js';

export {matchNurbsPlaneCellSourceVertices3,refineNurbsPlaneCellSourceVertices3} from './geometry/nurbs-plane-cell-source-vertices3.js';
export type {NurbsPlaneCellSourceVertices3} from './geometry/nurbs-plane-cell-source-vertices3.js';

export {matchNurbsSpanIntervals3,nurbsSpanIntervalMatchPoint3,nurbsSpanIntervalMatchParameters3} from './geometry/nurbs-span-interval-match3.js';
export type {NurbsSpanInterval3,NurbsSpanIntervalMatchCertificate3,NurbsSpanIntervalMatch3} from './geometry/nurbs-span-interval-match3.js';

export {matchNurbsPlaneCellSourceEdges3} from './geometry/nurbs-plane-cell-source-edges3.js';
export type {NurbsPlaneCellSourceEdge3,NurbsPlaneCellSourceEdges3} from './geometry/nurbs-plane-cell-source-edges3.js';

export {nurbsPlaneCellRationalMap3,nurbsPlaneCellRationalMapPoint3} from './geometry/nurbs-plane-cell-rational-map3.js';
export type {NurbsPlaneCellRationalMap3,NurbsPlaneCellRationalMapResult3,NurbsPlaneCellRationalPoint3} from './geometry/nurbs-plane-cell-rational-map3.js';

export {nodeNurbsPlaneCellSourceEdges3} from './geometry/nurbs-plane-cell-source-nodes3.js';
export type {NurbsPlaneCellSourceNodes3,NurbsPlaneCellSourceNoding3} from './geometry/nurbs-plane-cell-source-nodes3.js';

export {buildNurbsPlaneSplitFaces3,nurbsPlaneSplitFaceEdgePoint3} from './geometry/nurbs-plane-split-faces3.js';
export type {NurbsPlaneSplitFaceEdge3,NurbsPlaneSplitFaceSurface3,NurbsPlaneSplitFaces3} from './geometry/nurbs-plane-split-faces3.js';

export {sewNurbsPlaneSplitFaces3,sewnNurbsPlaneSplitEdgePoint3} from './geometry/sew-nurbs-plane-split-faces3.js';
export type {SewnNurbsPlaneSplitEdge3,SewnNurbsPlaneSplitFaces3} from './geometry/sew-nurbs-plane-split-faces3.js';
export {nurbsPlaneCapBoundary3,nurbsPlaneCapBoundaryPoint3} from './geometry/nurbs-plane-cap-boundary3.js';
export type {NurbsPlaneCapBoundary3,NurbsPlaneCapBoundaryCertificate3} from './geometry/nurbs-plane-cap-boundary3.js';
export {partitionSewnNurbsSplitEdgeByPlane3} from './geometry/sewn-nurbs-split-edge-plane3.js';
export type {SewnNurbsSplitEdgePlane3} from './geometry/sewn-nurbs-split-edge-plane3.js';
export {queryNurbsPlaneCapWinding3} from './geometry/nurbs-plane-cap-winding3.js';
export type {NurbsPlaneCapWinding3} from './geometry/nurbs-plane-cap-winding3.js';
export {partitionSewnNurbsSplitEdgeByAlgebraicPlane3} from './geometry/sewn-nurbs-split-edge-plane3.js';
export type {AlgebraicOffsetPlane3} from './geometry/sewn-nurbs-split-edge-plane3.js';
export {queryNurbsPlaneCapLoopWinding3} from './geometry/nurbs-plane-cap-winding3.js';
export type {NurbsPlaneCapLoopWinding3} from './geometry/nurbs-plane-cap-winding3.js';
export {analyzeNurbsPlaneCapContainment3} from './geometry/nurbs-plane-cap-containment3.js';
export type {NurbsPlaneCapContainment3,NurbsPlaneCapContainmentCertificate3} from './geometry/nurbs-plane-cap-containment3.js';
export {capNurbsPlaneSplitFaces3} from './geometry/cap-nurbs-plane-split-faces3.js';
export type {CappedNurbsPlaneSplitFaces3,CappedNurbsPlaneFaceSurface3,NurbsPlaneCapFaceSurface3} from './geometry/cap-nurbs-plane-split-faces3.js';
export {locateNurbsPlaneCapFace3,nurbsPlaneCapFacePoint3} from './geometry/nurbs-plane-cap-face-query3.js';
export type {NurbsPlaneCapFaceLocation3} from './geometry/nurbs-plane-cap-face-query3.js';
export {locateNurbsPlaneSplitFace3} from './geometry/nurbs-plane-split-face-query3.js';
export type {NurbsPlaneSplitFaceLocation3} from './geometry/nurbs-plane-split-face-query3.js';
export {locateCappedNurbsPlaneFace3,locateCappedNurbsPlaneMaterial3} from './geometry/capped-nurbs-plane-query3.js';
export type {CappedNurbsPlaneFaceLocation3,CappedNurbsPlaneMaterialLocation3} from './geometry/capped-nurbs-plane-query3.js';
