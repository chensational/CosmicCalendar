import { Body } from 'astronomy-engine';

export const AU_KM = 149_597_870.7;
export const JULIAN_YEAR_SECONDS = 365.25 * 86_400;
export const EARTH_AGE_YEARS = 4.54e9;
export const MOON_AGE_YEARS = 4.51e9;
export const SUN_AGE_YEARS = 4.567e9;
export const MILKY_WAY_AGE_YEARS = 13.6e9;
export const UNIVERSE_AGE_YEARS = 13.8e9;
export const EARTH_SIDEREAL_DAY_SECONDS = 86_164.0905;
export const MOON_SIDEREAL_PERIOD_SECONDS = 27.321661 * 86_400;
export const EARTH_ORBITAL_SPEED_KM_S = 29.78;
export const MOON_ORBITAL_SPEED_KM_S = 1.022;
export const SUN_GALACTIC_SPEED_KM_S = 233.3;
export const LOCAL_GROUP_CMB_SPEED_KM_S = 627;
export const WGS84_EQUATORIAL_RADIUS_KM = 6_378.137;
export const WGS84_ECCENTRICITY_SQUARED = 6.69437999014e-3;
export const MOON_MEAN_RADIUS_KM = 1_737.4;
export const APOLLO_11_SITE = Object.freeze({
  latitude: 0.67409,
  longitude: 23.47298,
  label: 'Tranquility Base',
});
export const GALACTIC_CENTER_DISTANCE_KPC = 8.249;
export const SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC = 20.8;
export const SUN_VERTICAL_OSCILLATION_PERIOD_MILLION_YEARS = 87.8;
export const SUN_GALACTIC_ORBIT_PERIOD_MILLION_YEARS = 224.2;

export const DEFAULT_LOCATION = Object.freeze({
  latitude: 43.0731,
  longitude: -89.4012,
  elevationMeters: 270,
  label: 'Madison, Wisconsin',
  source: 'default' as const,
});

export const PLANETS = Object.freeze([
  {
    body: Body.Mercury, key: 'mercury', name: 'Mercury', color: '#b6aa9d', radiusKm: 2_439.7,
    rotationPeriodHours: 1_407.6,
    orbit: { semiMajorAxisAu: 0.38709843, eccentricity: 0.20563661, inclinationDegrees: 7.00559432, longitudePerihelionDegrees: 77.45771895, ascendingNodeDegrees: 48.33961819 },
  },
  {
    body: Body.Venus, key: 'venus', name: 'Venus', color: '#e6c990', radiusKm: 6_051.8,
    rotationPeriodHours: -5_832.5,
    orbit: { semiMajorAxisAu: 0.72332102, eccentricity: 0.00676399, inclinationDegrees: 3.39777545, longitudePerihelionDegrees: 131.76755713, ascendingNodeDegrees: 76.67261496 },
  },
  {
    body: Body.Earth, key: 'earth', name: 'Earth', color: '#4d8fc8', radiusKm: 6_371,
    rotationPeriodHours: 23.9345,
    orbit: { semiMajorAxisAu: 1.00000018, eccentricity: 0.01673163, inclinationDegrees: -0.00054346, longitudePerihelionDegrees: 102.93005885, ascendingNodeDegrees: -5.11260389 },
  },
  {
    body: Body.Mars, key: 'mars', name: 'Mars', color: '#c96647', radiusKm: 3_389.5,
    rotationPeriodHours: 24.6229,
    orbit: { semiMajorAxisAu: 1.52371243, eccentricity: 0.09336511, inclinationDegrees: 1.85181869, longitudePerihelionDegrees: -23.91744784, ascendingNodeDegrees: 49.71320984 },
  },
  {
    body: Body.Jupiter, key: 'jupiter', name: 'Jupiter', color: '#d8b48b', radiusKm: 69_911,
    rotationPeriodHours: 9.925,
    orbit: { semiMajorAxisAu: 5.20248019, eccentricity: 0.04853590, inclinationDegrees: 1.29861416, longitudePerihelionDegrees: 14.27495244, ascendingNodeDegrees: 100.29282654 },
  },
  {
    body: Body.Saturn, key: 'saturn', name: 'Saturn', color: '#dbc992', radiusKm: 58_232,
    rotationPeriodHours: 10.656,
    orbit: { semiMajorAxisAu: 9.54149883, eccentricity: 0.05550825, inclinationDegrees: 2.49424102, longitudePerihelionDegrees: 92.86136063, ascendingNodeDegrees: 113.63998702 },
  },
  {
    body: Body.Uranus, key: 'uranus', name: 'Uranus', color: '#9bd7db', radiusKm: 25_362,
    rotationPeriodHours: -17.24,
    orbit: { semiMajorAxisAu: 19.18797948, eccentricity: 0.04685740, inclinationDegrees: 0.77298127, longitudePerihelionDegrees: 172.43404441, ascendingNodeDegrees: 73.96250215 },
  },
  {
    body: Body.Neptune, key: 'neptune', name: 'Neptune', color: '#4169c1', radiusKm: 24_622,
    rotationPeriodHours: 16.11,
    orbit: { semiMajorAxisAu: 30.06952752, eccentricity: 0.00895439, inclinationDegrees: 1.77005520, longitudePerihelionDegrees: 46.68158724, ascendingNodeDegrees: 131.78635853 },
  },
  {
    body: Body.Pluto, key: 'pluto', name: 'Pluto', color: '#c7b6a5', radiusKm: 1_188.3,
    rotationPeriodHours: -153.2928,
    orbit: { semiMajorAxisAu: 39.236, eccentricity: 0.2444, inclinationDegrees: 17.16, longitudePerihelionDegrees: 224.067, ascendingNodeDegrees: 110.299 },
  },
]);

export const MAJOR_SATELLITES = Object.freeze([
  { key: 'moon', name: 'Moon', parent: 'earth', radiusKm: 1_737.4, semiMajorAxisKm: 384_400, periodDays: 27.321661 },
  { key: 'phobos', name: 'Phobos', parent: 'mars', radiusKm: 11.267, semiMajorAxisKm: 9_376, periodDays: 0.31891 },
  { key: 'deimos', name: 'Deimos', parent: 'mars', radiusKm: 6.2, semiMajorAxisKm: 23_463, periodDays: 1.26244 },
  { key: 'io', name: 'Io', parent: 'jupiter', radiusKm: 1_821.6, semiMajorAxisKm: 421_700, periodDays: 1.769138 },
  { key: 'europa', name: 'Europa', parent: 'jupiter', radiusKm: 1_560.8, semiMajorAxisKm: 671_034, periodDays: 3.551181 },
  { key: 'ganymede', name: 'Ganymede', parent: 'jupiter', radiusKm: 2_634.1, semiMajorAxisKm: 1_070_412, periodDays: 7.154553 },
  { key: 'callisto', name: 'Callisto', parent: 'jupiter', radiusKm: 2_410.3, semiMajorAxisKm: 1_882_709, periodDays: 16.689018 },
  { key: 'mimas', name: 'Mimas', parent: 'saturn', radiusKm: 198.2, semiMajorAxisKm: 185_539, periodDays: 0.942422 },
  { key: 'enceladus', name: 'Enceladus', parent: 'saturn', radiusKm: 252.1, semiMajorAxisKm: 238_042, periodDays: 1.370218 },
  { key: 'tethys', name: 'Tethys', parent: 'saturn', radiusKm: 531.1, semiMajorAxisKm: 294_672, periodDays: 1.887802 },
  { key: 'dione', name: 'Dione', parent: 'saturn', radiusKm: 561.4, semiMajorAxisKm: 377_415, periodDays: 2.736915 },
  { key: 'rhea', name: 'Rhea', parent: 'saturn', radiusKm: 763.8, semiMajorAxisKm: 527_068, periodDays: 4.518212 },
  { key: 'titan', name: 'Titan', parent: 'saturn', radiusKm: 2_574.7, semiMajorAxisKm: 1_221_870, periodDays: 15.945421 },
  { key: 'iapetus', name: 'Iapetus', parent: 'saturn', radiusKm: 734.5, semiMajorAxisKm: 3_560_820, periodDays: 79.3215 },
  { key: 'ariel', name: 'Ariel', parent: 'uranus', radiusKm: 578.9, semiMajorAxisKm: 191_020, periodDays: 2.520379 },
  { key: 'umbriel', name: 'Umbriel', parent: 'uranus', radiusKm: 584.7, semiMajorAxisKm: 266_300, periodDays: 4.144177 },
  { key: 'titania', name: 'Titania', parent: 'uranus', radiusKm: 788.9, semiMajorAxisKm: 435_910, periodDays: 8.705872 },
  { key: 'oberon', name: 'Oberon', parent: 'uranus', radiusKm: 761.4, semiMajorAxisKm: 583_520, periodDays: 13.463239 },
  { key: 'triton', name: 'Triton', parent: 'neptune', radiusKm: 1_353.4, semiMajorAxisKm: 354_759, periodDays: -5.876854 },
  { key: 'charon', name: 'Charon', parent: 'pluto', radiusKm: 606, semiMajorAxisKm: 19_596, periodDays: 6.3872 },
]);

export const PARENT_RADIUS_KM: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(PLANETS.map((planet) => [planet.key, planet.radiusKm])),
);
