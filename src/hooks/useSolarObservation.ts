import { useEffect, useMemo, useState } from 'react';
import solarImageUrl from '../data/sun-hmi.jpg';
import solarManifest from '../data/sun-hmi.json';
import { solarObservationMatchesDate } from '../core/solarSurface';

export interface SolarObservation {
  image: HTMLImageElement;
  observedAt: Date;
  credit: string;
}

/** Loads the checked-in same-origin SDO frame only when it matches the viewed date. */
export function useSolarObservation(date: Date): SolarObservation | undefined {
  const [image, setImage] = useState<HTMLImageElement>();
  const observedAtMilliseconds = Date.parse(solarManifest.observedAt);

  useEffect(() => {
    let active = true;
    const nextImage = new Image();
    nextImage.decoding = 'async';
    nextImage.onload = () => {
      if (active) setImage(nextImage);
    };
    nextImage.src = solarImageUrl;
    return () => { active = false; };
  }, []);

  return useMemo(() => {
    if (!image || !Number.isFinite(observedAtMilliseconds)) return undefined;
    const observedAt = new Date(observedAtMilliseconds);
    if (!solarObservationMatchesDate(date, observedAt)) {
      return undefined;
    }
    return {
      image,
      observedAt,
      credit: solarManifest.credit,
    };
  }, [date, image, observedAtMilliseconds]);
}
