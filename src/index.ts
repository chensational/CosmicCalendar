import './styles/cosmic-calendar.css';

export { CosmicCalendar } from './components/CosmicCalendar';
export type { CosmicCalendarProps } from './components/CosmicCalendar';
export { default as CosmicWatermark } from './CosmicWatermark/CosmicWatermark.jsx';
export { getHorizonSnapshot, getLunarHorizonSnapshot, getSolarSystemSnapshot } from './core/ephemeris';
export { getDistanceMetrics, earthParallelRadiusKm, earthSurfaceRotationSpeedKmPerSecond, formatCosmicDistance } from './core/distances';
export { buildCalendarMonth } from './core/calendar';
export { COSMIC_EPOCHS, PRESENT_EPOCH_INDEX, interpolateCosmicAge, formatCosmicAge } from './core/cosmicTime';
export type * from './core/types';
