import { UNIVERSE_AGE_YEARS } from './constants';

const LN_2 = Math.log(2);
const LN_10 = Math.log(10);
const OMEGA_MATTER = 0.315;
const OMEGA_RADIATION = 9.2e-5;
const OMEGA_LAMBDA = 1 - OMEGA_MATTER - OMEGA_RADIATION;
const HUBBLE_KM_S_MPC = 67.4;
const KM_PER_MPC = 3.085677581491367e19;
const SECONDS_PER_GIGAYEAR = 365.25 * 86_400 * 1e9;
const HUBBLE_PER_GIGAYEAR = HUBBLE_KM_S_MPC / KM_PER_MPC * SECONDS_PER_GIGAYEAR;
const MATTER_LAMBDA_TIME_SCALE_GYR = 2 / (3 * HUBBLE_PER_GIGAYEAR * Math.sqrt(OMEGA_LAMBDA));

export interface CosmicFlowGroup {
  /** Supergalactic Cartesian coordinates in h^-1 Mpc (published velocity units / 100). */
  sgx: number;
  sgy: number;
  sgz: number;
  /** Published line-of-sight peculiar velocity. */
  peculiarVelocityKmPerSecond: number;
}

export interface ProbabilisticBasinCore {
  key: string;
  name: string;
  sgx: number;
  sgy: number;
  sgz: number;
  sigmaSgx: number;
  sigmaSgy: number;
  sigmaSgz: number;
  existenceProbabilityPercent: number;
  volumeMillionCubicHInverseMpc: number;
  color: string;
}

export interface MilkyWayBasinAssociation {
  basinKey: 'shapley' | 'ophiuchus' | 'south-pole-wall' | 'other';
  inspectedProbabilityPercent: number;
  automaticProbabilityPercent?: number;
}

/** Valade et al. (2024), Extended Data Table 2, SG coordinates in h^-1 Mpc. */
export const PROBABILISTIC_BASIN_CORES: readonly ProbabilisticBasinCore[] = Object.freeze([
  { key: 'shapley', name: 'Shapley', sgx: -145.1, sgy: 59.1, sgz: -12.2, sigmaSgx: 5.8, sigmaSgy: 10.7, sigmaSgz: 8.7, existenceProbabilityPercent: 90, volumeMillionCubicHInverseMpc: 7.02, color: '#e7b35f' },
  { key: 'ophiuchus', name: 'Ophiuchus / Laniākea', sgx: -59.4, sgy: 14.6, sgz: 38.6, sigmaSgx: 7, sigmaSgy: 9.3, sigmaSgz: 16.1, existenceProbabilityPercent: 62, volumeMillionCubicHInverseMpc: 0.8, color: '#c98bc9' },
  { key: 'hercules', name: 'Hercules', sgx: -39.6, sgy: 86.4, sgz: 79.5, sigmaSgx: 5.7, sigmaSgy: 8.6, sigmaSgz: 6.5, existenceProbabilityPercent: 99, volumeMillionCubicHInverseMpc: 1.86, color: '#82c9a4' },
  { key: 'perseus', name: 'Perseus', sgx: 47.8, sgy: -18.3, sgz: -32.7, sigmaSgx: 2.7, sigmaSgy: 14.6, sigmaSgz: 4.1, existenceProbabilityPercent: 93, volumeMillionCubicHInverseMpc: 1.06, color: '#72bfe3' },
  { key: 'south-pole-wall', name: 'South Pole Wall', sgx: -132.1, sgy: -48.6, sgz: 18.7, sigmaSgx: 11.5, sigmaSgy: 26.7, sigmaSgz: 23, existenceProbabilityPercent: 66, volumeMillionCubicHInverseMpc: 3.4, color: '#91a9df' },
]);

/** Valade et al. (2024), Extended Data Table 1; larger values include nearby scattered sinks. */
export const MILKY_WAY_BASIN_ASSOCIATIONS: readonly MilkyWayBasinAssociation[] = Object.freeze([
  { basinKey: 'shapley', inspectedProbabilityPercent: 58, automaticProbabilityPercent: 48 },
  { basinKey: 'ophiuchus', inspectedProbabilityPercent: 39, automaticProbabilityPercent: 38 },
  { basinKey: 'south-pole-wall', inspectedProbabilityPercent: 1 },
  { basinKey: 'other', inspectedProbabilityPercent: 2, automaticProbabilityPercent: 12 },
]);

const EXPANSION_LOOKUP_STEPS = 2_048;
const EXPANSION_LOG_A_MIN = -80;
const expansionLogScale = new Float64Array(EXPANSION_LOOKUP_STEPS + 1);
const expansionAgeGyr = new Float64Array(EXPANSION_LOOKUP_STEPS + 1);
let previousDtDLogA = 0;
for (let index = 0; index <= EXPANSION_LOOKUP_STEPS; index += 1) {
  const logA = EXPANSION_LOG_A_MIN * (1 - index / EXPANSION_LOOKUP_STEPS);
  const inverseA = Math.exp(-logA);
  const hubble = HUBBLE_PER_GIGAYEAR * Math.sqrt(
    OMEGA_RADIATION * inverseA ** 4 +
    OMEGA_MATTER * inverseA ** 3 +
    OMEGA_LAMBDA,
  );
  const dtDLogA = 1 / hubble;
  expansionLogScale[index] = logA;
  if (index > 0) {
    const step = expansionLogScale[index] - expansionLogScale[index - 1];
    expansionAgeGyr[index] = expansionAgeGyr[index - 1] +
      (previousDtDLogA + dtDLogA) * 0.5 * step;
  }
  previousDtDLogA = dtDLogA;
}
const expansionModelPresentAgeGyr = expansionAgeGyr[EXPANSION_LOOKUP_STEPS];

function logSinh(value: number): number {
  if (value > 20) return value - LN_2;
  return Math.log(Math.sinh(Math.max(value, Number.MIN_VALUE)));
}

/**
 * Scale factor for a spatially flat radiation+matter+Lambda background, normalized
 * to a=1 at the UI's 13.8 Gyr present. The historical branch numerically integrates
 * Friedmann expansion in log(a); the future branch uses the stable matter+Lambda
 * closed form because radiation is negligible there.
 */
export function flatLambdaCdmLog10ScaleFactor(ageYears: number): number {
  const presentGyr = UNIVERSE_AGE_YEARS / 1e9;
  const ageGyr = Math.max(Number.MIN_VALUE, ageYears / 1e9);
  if (ageGyr <= presentGyr) {
    const targetAge = ageGyr / presentGyr * expansionModelPresentAgeGyr;
    let lower = 0;
    let upper = EXPANSION_LOOKUP_STEPS;
    while (upper - lower > 1) {
      const middle = Math.floor((lower + upper) / 2);
      if (expansionAgeGyr[middle] <= targetAge) lower = middle;
      else upper = middle;
    }
    const ageSpan = expansionAgeGyr[upper] - expansionAgeGyr[lower];
    const fraction = ageSpan > 0
      ? (targetAge - expansionAgeGyr[lower]) / ageSpan
      : 0;
    const logScale = expansionLogScale[lower] +
      (expansionLogScale[upper] - expansionLogScale[lower]) * fraction;
    return logScale / LN_10;
  }
  return 2 / 3 * (
    logSinh(ageGyr / MATTER_LAMBDA_TIME_SCALE_GYR) -
    logSinh(presentGyr / MATTER_LAMBDA_TIME_SCALE_GYR)
  ) / LN_10;
}

export function formatRelativeScaleFactor(log10ScaleFactor: number): string {
  if (Math.abs(log10ScaleFactor) < 0.004) return '1.000';
  if (log10ScaleFactor > -3 && log10ScaleFactor < 3) {
    return (10 ** log10ScaleFactor).toPrecision(3);
  }
  return `10^${log10ScaleFactor.toFixed(Math.abs(log10ScaleFactor) < 100 ? 1 : 0)}`;
}
