import { describe, expect, it } from 'vitest';
import {
  COSMIC_EPOCHS,
  PRESENT_EPOCH_INDEX,
  formatCosmicAge,
  interpolateCosmicAge,
  nearestCosmicEpoch,
} from '../src/core/cosmicTime';

describe('logarithmic cosmic timeline', () => {
  it('covers inflation through the heat-death horizon', () => {
    expect(COSMIC_EPOCHS[0].ageYears).toBe(1e-36);
    expect(COSMIC_EPOCHS.at(-1)?.ageYears).toBe(1e100);
    expect(nearestCosmicEpoch(PRESENT_EPOCH_INDEX).key).toBe('present');
  });

  it('interpolates between epochs logarithmically', () => {
    const lower = COSMIC_EPOCHS[8].ageYears;
    const upper = COSMIC_EPOCHS[9].ageYears;
    const midpoint = interpolateCosmicAge(8.5);
    expect(Math.log10(midpoint)).toBeCloseTo((Math.log10(lower) + Math.log10(upper)) / 2, 10);
    expect(formatCosmicAge(1e40)).toContain('e+40');
  });
});
