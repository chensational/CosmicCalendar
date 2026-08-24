import { UNIVERSE_AGE_YEARS } from './constants';
import { clamp } from './math';
import type { CosmicEpoch } from './types';

export const COSMIC_EPOCHS: readonly CosmicEpoch[] = Object.freeze([
  { key: 'inflation', label: 'Cosmic inflation', ageYears: 1e-36, detail: 'The observable universe expands from a primordial quantum-scale state.' },
  { key: 'recombination', label: 'First light', ageYears: 380_000, detail: 'Atoms form and the cosmic microwave background becomes free to travel.' },
  { key: 'first-stars', label: 'First stars', ageYears: 2e8, detail: 'Gravity lights the first generation of stars.' },
  { key: 'milky-way', label: 'Milky Way assembling', ageYears: 2e8, detail: 'The oldest Galactic populations begin assembling; formation remains gradual.' },
  { key: 'sun-birth', label: 'Sun is born', ageYears: UNIVERSE_AGE_YEARS - 4.567e9, detail: 'A molecular cloud collapses into the Solar System.' },
  { key: 'earth-birth', label: 'Earth forms', ageYears: UNIVERSE_AGE_YEARS - 4.54e9, detail: 'Accretion builds the world beneath your feet.' },
  { key: 'present', label: 'You are here', ageYears: UNIVERSE_AGE_YEARS, detail: 'Matter has become able to notice, remember, and participate.' },
  { key: 'red-giant', label: 'Solar red giant', ageYears: UNIVERSE_AGE_YEARS + 5e9, detail: 'The Sun exhausts core hydrogen and expands.' },
  { key: 'stellar-era-end', label: 'Last stars fade', ageYears: 1e14, detail: 'Conventional star formation has effectively ended.' },
  { key: 'black-hole-era', label: 'Black-hole era', ageYears: 1e40, detail: 'Compact remnants dominate an extremely dilute universe.' },
  { key: 'heat-death', label: 'Heat death horizon', ageYears: 1e100, detail: 'An illustrative thermodynamic limit: no useful free-energy gradients remain.' },
]);

export const PRESENT_EPOCH_INDEX = COSMIC_EPOCHS.findIndex((epoch) => epoch.key === 'present');

export function interpolateCosmicAge(position: number): number {
  const clamped = clamp(position, 0, COSMIC_EPOCHS.length - 1);
  const lowerIndex = Math.floor(clamped);
  const upperIndex = Math.ceil(clamped);
  const lower = COSMIC_EPOCHS[lowerIndex];
  const upper = COSMIC_EPOCHS[upperIndex];
  if (lowerIndex === upperIndex || lower.ageYears <= 0) return lower.ageYears;
  const fraction = clamped - lowerIndex;
  const lowerLog = Math.log10(lower.ageYears);
  const upperLog = Math.log10(upper.ageYears);
  return 10 ** (lowerLog + (upperLog - lowerLog) * fraction);
}

export function nearestCosmicEpoch(position: number): CosmicEpoch {
  return COSMIC_EPOCHS[Math.round(clamp(position, 0, COSMIC_EPOCHS.length - 1))];
}

export function formatCosmicAge(ageYears: number): string {
  if (ageYears < 1) return `${ageYears.toExponential(1)} years after the Big Bang`;
  if (ageYears < 1e6) return `${Math.round(ageYears).toLocaleString()} years after the Big Bang`;
  if (ageYears < 1e9) return `${(ageYears / 1e6).toLocaleString(undefined, { maximumSignificantDigits: 4 })} million years`;
  if (ageYears < 1e13) return `${(ageYears / 1e9).toLocaleString(undefined, { maximumSignificantDigits: 5 })} billion years`;
  return `${ageYears.toExponential(2)} years after the Big Bang`;
}
