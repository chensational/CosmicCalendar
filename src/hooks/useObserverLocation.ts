import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_LOCATION } from '../core/constants';
import { clamp } from '../core/math';
import type { ObserverLocation } from '../core/types';

const STORAGE_KEY = 'cosmic-calendar-location-v1';

function sanitizeLocation(location: ObserverLocation): ObserverLocation {
  return {
    latitude: clamp(Number(location.latitude), -90, 90),
    longitude: clamp(Number(location.longitude), -180, 180),
    elevationMeters: clamp(Number(location.elevationMeters) || 0, -500, 12_000),
    label: location.label?.trim() || 'Custom location',
    source: location.source ?? 'manual',
  };
}

export function useObserverLocation(initial?: Partial<ObserverLocation>) {
  const [location, setLocationState] = useState<ObserverLocation>(() => {
    if (initial?.latitude !== undefined && initial.longitude !== undefined) {
      return sanitizeLocation({
        ...DEFAULT_LOCATION,
        ...initial,
        source: initial.source ?? 'manual',
      });
    }
    try {
      if (typeof window === 'undefined') return DEFAULT_LOCATION;
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? sanitizeLocation(JSON.parse(stored) as ObserverLocation) : DEFAULT_LOCATION;
    } catch {
      return DEFAULT_LOCATION;
    }
  });
  const [permissionState, setPermissionState] = useState<PermissionState | 'unavailable'>('prompt');
  const [error, setError] = useState<string>();

  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' }).then((status) => {
      setPermissionState(status.state);
      status.addEventListener('change', () => setPermissionState(status.state));
    }).catch(() => setPermissionState('unavailable'));
  }, []);

  const setLocation = useCallback((next: ObserverLocation) => {
    const safe = sanitizeLocation(next);
    setLocationState(safe);
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch {
      // Storage is optional; location never leaves the device through this component.
    }
  }, []);

  const requestDeviceLocation = useCallback(() => {
    setError(undefined);
    if (!navigator.geolocation) {
      setError('Geolocation is unavailable in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        elevationMeters: position.coords.altitude ?? 0,
        label: 'Your device location',
        source: 'device',
      }),
      (reason) => setError(reason.message || 'Location permission was not granted.'),
      { enableHighAccuracy: false, maximumAge: 900_000, timeout: 10_000 },
    );
  }, [setLocation]);

  return { location, setLocation, requestDeviceLocation, permissionState, error };
}
