export interface ObserverLocation {
  latitude: number;
  longitude: number;
  elevationMeters: number;
  label?: string;
  source?: 'device' | 'manual' | 'default';
}

export interface HorizontalPosition {
  altitudeDegrees: number;
  azimuthDegrees: number;
  distanceKm?: number;
  apparentMotion?: {
    altitudeDegreesPerSecond: number;
    azimuthDegreesPerSecond: number;
  };
}

export interface HorizonSnapshot {
  date: Date;
  observer: ObserverLocation;
  sun: HorizontalPosition;
  moon: HorizontalPosition & {
    phaseAngleDegrees: number;
    illuminatedFraction: number;
  };
  galacticCenter: HorizontalPosition;
  milkyWay: HorizontalPosition[];
}

export interface LunarHorizonSnapshot {
  date: Date;
  siteLatitudeDegrees: number;
  siteLongitudeDegrees: number;
  earth: HorizontalPosition & {
    angularDiameterDegrees: number;
    phaseAngleDegrees: number;
    illuminatedFraction: number;
  };
}

export interface CartesianPosition {
  x: number;
  y: number;
  z: number;
}

export interface OrbitalElements {
  semiMajorAxisAu: number;
  eccentricity: number;
  inclinationDegrees: number;
  longitudePerihelionDegrees: number;
  ascendingNodeDegrees: number;
}

export interface PlanetState {
  key: string;
  name: string;
  color: string;
  radiusKm: number;
  heliocentricAu: CartesianPosition;
  distanceAu: number;
  eclipticLongitudeDegrees: number;
  eclipticLatitudeDegrees: number;
  illuminatedFraction: number;
  phaseAngleDegrees: number;
  ringTiltDegrees?: number;
  primeMeridianDegrees: number;
  rotationPeriodHours: number;
  orbit: OrbitalElements;
}

export interface SatelliteState {
  key: string;
  name: string;
  parent: string;
  radiusKm: number;
  semiMajorAxisKm: number;
  relativePositionKm: CartesianPosition;
  illuminatedFraction: number;
  sunlit: boolean;
  model: 'integrated' | 'jpl-reference-kepler';
}

export interface SolarSystemSnapshot {
  date: Date;
  planets: PlanetState[];
  satellites: SatelliteState[];
  mercuryPerihelionLongitudeDegrees: number;
  mercuryRelativisticPrecessionArcsecondsPerCentury: number;
  validity: 'ephemeris' | 'illustrative';
}

export interface DistanceMetric {
  key: string;
  label: string;
  distanceKm: number;
  cmbFrameDistanceKm?: number;
  currentSpeedKmPerSecond: number;
  method: string;
}

export type CosmicScale = 'horizon' | 'solar-system' | 'milky-way' | 'universe';

export interface CosmicEpoch {
  key: string;
  label: string;
  ageYears: number;
  detail: string;
}
