/** Public API of revolve and sweep (M3): solids of revolution, rotation-minimizing frames, swept solids. */
export { type RevolveAxis } from './meridian.ts';
export { revolve, revolveVolume } from './revolve.ts';
export { type PathFrame, MAX_FRAME_STATIONS, doubleReflectionStep, frameMotion, reflect3, rotationMinimizingFrames } from './frames.ts';
export { type Interpolation, interpolation, interpolationValue } from './interpolate.ts';
export { type SweepFrame, type SweepOptions, type SweepReport, MAX_SWEEP_STATIONS, sweep, sweepWithReport } from './sweep.ts';
