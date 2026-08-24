import { describe, expect, it } from 'vitest';
import {
  MILKY_WAY_BASIN_ASSOCIATIONS,
  PROBABILISTIC_BASIN_CORES,
  flatLambdaCdmLog10ScaleFactor,
  formatRelativeScaleFactor,
} from '../src/core/cosmicFlowModel';
import { CF4_SUPERGALACTIC_SLICE } from '../src/core/cosmicFlowCatalog';
import {
  CF4_GROUP_SAMPLE_COUNT,
  CF4_GROUP_SLICE_AVAILABLE_COUNT,
  CF4_GROUP_SOURCE_ROW_COUNT,
  CF4_GROUP_SOURCE_SHA256,
} from '../src/data/cosmicFlowMetadata';
import { UNIVERSE_AGE_YEARS } from '../src/core/constants';

describe('published Cosmicflows-4 slice', () => {
  it('decodes the pinned deterministic group sample', () => {
    expect(CF4_GROUP_SOURCE_SHA256).toBe('be91d4fae6fa01552ab3bc85db695411fca3249eeae08b566a712e6ea790bd99');
    expect(CF4_GROUP_SOURCE_ROW_COUNT).toBe(38_053);
    expect(CF4_GROUP_SLICE_AVAILABLE_COUNT).toBe(3_800);
    expect(CF4_GROUP_SAMPLE_COUNT).toBe(1_900);
    expect(CF4_SUPERGALACTIC_SLICE).toHaveLength(CF4_GROUP_SAMPLE_COUNT);
    for (const group of CF4_SUPERGALACTIC_SLICE) {
      expect(group.sgx).toBeGreaterThanOrEqual(-180);
      expect(group.sgx).toBeLessThanOrEqual(80);
      expect(group.sgy).toBeGreaterThanOrEqual(-85);
      expect(group.sgy).toBeLessThanOrEqual(120);
      expect(Math.abs(group.sgz)).toBeLessThanOrEqual(10);
      expect(Number.isFinite(group.peculiarVelocityKmPerSecond)).toBe(true);
    }
  });

  it('retains the measured basin cores, errors, volumes, and probabilities', () => {
    const shapley = PROBABILISTIC_BASIN_CORES.find((basin) => basin.key === 'shapley')!;
    const ophiuchus = PROBABILISTIC_BASIN_CORES.find((basin) => basin.key === 'ophiuchus')!;
    expect(shapley).toMatchObject({ sgx: -145.1, sgy: 59.1, sgz: -12.2, existenceProbabilityPercent: 90, volumeMillionCubicHInverseMpc: 7.02 });
    expect(ophiuchus).toMatchObject({ sgx: -59.4, sgy: 14.6, sgz: 38.6, existenceProbabilityPercent: 62, volumeMillionCubicHInverseMpc: 0.8 });
    expect(ophiuchus.sigmaSgz).toBe(16.1);
  });

  it('shows the current Milky Way basin ambiguity rather than one certain attractor', () => {
    expect(MILKY_WAY_BASIN_ASSOCIATIONS).toEqual([
      { basinKey: 'shapley', inspectedProbabilityPercent: 58, automaticProbabilityPercent: 48 },
      { basinKey: 'ophiuchus', inspectedProbabilityPercent: 39, automaticProbabilityPercent: 38 },
      { basinKey: 'south-pole-wall', inspectedProbabilityPercent: 1 },
      { basinKey: 'other', inspectedProbabilityPercent: 2, automaticProbabilityPercent: 12 },
    ]);
  });
});

describe('flat matter-plus-Lambda scale-factor reference', () => {
  it('is exactly normalized at the present epoch', () => {
    expect(flatLambdaCdmLog10ScaleFactor(UNIVERSE_AGE_YEARS)).toBeCloseTo(0, 14);
    expect(formatRelativeScaleFactor(0)).toBe('1.000');
  });

  it('is near the observed recombination scale while remaining explicitly approximate', () => {
    const recombination = flatLambdaCdmLog10ScaleFactor(380_000);
    expect(10 ** recombination).toBeGreaterThan(1 / 1_200);
    expect(10 ** recombination).toBeLessThan(1 / 1_000);
    expect(formatRelativeScaleFactor(recombination)).toMatch(/^10\^-/);
  });

  it('remains finite and monotonic across the hypothetical far future', () => {
    const present = flatLambdaCdmLog10ScaleFactor(UNIVERSE_AGE_YEARS);
    const redGiant = flatLambdaCdmLog10ScaleFactor(UNIVERSE_AGE_YEARS + 5e9);
    const heatDeath = flatLambdaCdmLog10ScaleFactor(1e100);
    expect(redGiant).toBeGreaterThan(present);
    expect(heatDeath).toBeGreaterThan(redGiant);
    expect(Number.isFinite(heatDeath)).toBe(true);
  });
});
