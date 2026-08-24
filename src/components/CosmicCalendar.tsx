import { useEffect, useMemo, useState } from 'react';
import { buildCalendarMonth, formatMonthTitle } from '../core/calendar';
import {
  COSMIC_EPOCHS,
  PRESENT_EPOCH_INDEX,
  formatCosmicAge,
  interpolateCosmicAge,
  nearestCosmicEpoch,
} from '../core/cosmicTime';
import { formatCosmicDistance, getDistanceMetrics } from '../core/distances';
import { getHorizonSnapshot, getLunarHorizonSnapshot, getSolarSystemSnapshot } from '../core/ephemeris';
import { clamp } from '../core/math';
import type { CosmicScale, ObserverLocation } from '../core/types';
import { useObserverLocation } from '../hooks/useObserverLocation';
import { useBrightStarCatalog } from '../hooks/useBrightStarCatalog';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { getVisibleStars } from '../core/stars';
import { CosmicCanvas } from './CosmicCanvas';

export interface CosmicCalendarProps {
  className?: string;
  initialDate?: Date;
  initialLocation?: Partial<ObserverLocation>;
  onLocationChange?: (location: ObserverLocation) => void;
}

const SCALES: readonly { key: CosmicScale; short: string; title: string; description: string }[] = [
  { key: 'horizon', short: '01', title: 'Earth ↔ Moon', description: 'Your sky & Tranquility Base' },
  { key: 'solar-system', short: '02', title: 'Solar system', description: 'Planets, light & satellites' },
  { key: 'milky-way', short: '03', title: 'Milky Way', description: 'The Sun’s Galactic trail' },
  { key: 'universe', short: '04', title: 'Laniākea', description: 'Expansion & cosmic flow' },
];

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

function formatCoordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(3)}° ${value >= 0 ? positive : negative}`;
}

function formatAltitude(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}°`;
}

function formatAzimuth(value: number): string {
  return `${value.toFixed(1)}°`;
}

function MoonGlyph({ fraction, phase }: { fraction: number; phase: number }) {
  return (
    <span
      className="cc-moon-glyph"
      aria-label={`${Math.round(fraction * 100)} percent illuminated`}
      style={{
        '--moon-light': fraction.toFixed(3),
        '--moon-waxing': phase < 180 ? 1 : -1,
      } as React.CSSProperties}
    />
  );
}

function LocationEditor({
  location,
  onSave,
  onDeviceLocation,
  error,
}: {
  location: ObserverLocation;
  onSave: (next: ObserverLocation) => void;
  onDeviceLocation: () => void;
  error?: string;
}) {
  const [latitude, setLatitude] = useState(String(location.latitude));
  const [longitude, setLongitude] = useState(String(location.longitude));
  const [elevation, setElevation] = useState(String(location.elevationMeters));

  useEffect(() => {
    setLatitude(String(location.latitude));
    setLongitude(String(location.longitude));
    setElevation(String(location.elevationMeters));
  }, [location]);

  return (
    <div className="cc-location-editor">
      <p className="cc-location-privacy">Coordinates stay in this browser. They are used only for local sky geometry.</p>
      <div className="cc-location-fields">
        <label>Latitude<input type="number" min="-90" max="90" step="0.0001" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
        <label>Longitude<input type="number" min="-180" max="180" step="0.0001" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
        <label>Elevation m<input type="number" min="-500" max="12000" step="1" value={elevation} onChange={(event) => setElevation(event.target.value)} /></label>
      </div>
      <div className="cc-location-actions">
        <button type="button" className="cc-button cc-button-primary" onClick={onDeviceLocation}>Use device location</button>
        <button
          type="button"
          className="cc-button"
          onClick={() => onSave({
            latitude: Number(latitude),
            longitude: Number(longitude),
            elevationMeters: Number(elevation),
            label: 'Custom location',
            source: 'manual',
          })}
        >Apply coordinates</button>
      </div>
      {error && <p className="cc-location-error" role="alert">{error}</p>}
    </div>
  );
}

export function CosmicCalendar({
  className,
  initialDate,
  initialLocation,
  onLocationChange,
}: CosmicCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(() => initialDate ? new Date(initialDate) : new Date());
  const [live, setLive] = useState(!initialDate);
  const [scalePosition, setScalePosition] = useState(0);
  const [cosmicTimePosition, setCosmicTimePosition] = useState(PRESENT_EPOCH_INDEX);
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date(selectedDate));
  const [locationOpen, setLocationOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const starCatalog = useBrightStarCatalog();
  const { location, setLocation, requestDeviceLocation, error } = useObserverLocation(initialLocation);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setSelectedDate(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, [live]);

  useEffect(() => onLocationChange?.(location), [location, onLocationChange]);

  const calculationDate = useMemo(() => new Date(Math.floor(selectedDate.getTime() / 5_000) * 5_000), [selectedDate]);
  const horizon = useMemo(() => getHorizonSnapshot(calculationDate, location), [calculationDate, location]);
  const lunar = useMemo(() => getLunarHorizonSnapshot(calculationDate), [calculationDate]);
  const solar = useMemo(() => getSolarSystemSnapshot(calculationDate), [calculationDate]);
  const stars = useMemo(
    () => starCatalog && scalePosition < 1.2 && horizon.sun.altitudeDegrees < -1.5
      ? getVisibleStars(calculationDate, location, starCatalog)
      : [],
    [calculationDate, horizon.sun.altitudeDegrees, location, scalePosition, starCatalog],
  );
  const distanceMetrics = useMemo(() => getDistanceMetrics(location.latitude, calculationDate), [calculationDate, location.latitude]);
  const calendarDays = useMemo(() => buildCalendarMonth(calendarAnchor), [calendarAnchor]);
  const cosmicAgeYears = interpolateCosmicAge(cosmicTimePosition);
  const activeEpoch = nearestCosmicEpoch(cosmicTimePosition);
  const activeScaleIndex = Math.round(scalePosition);
  const activeScale = SCALES[activeScaleIndex];

  const changeScaleOrTime = (delta: number) => {
    if (!delta) return;
    setScalePosition((current) => {
      const proposed = current + delta;
      if (proposed < 0) {
        setCosmicTimePosition((time) => clamp(time - delta, 0, COSMIC_EPOCHS.length - 1));
        return 0;
      }
      if (proposed > SCALES.length - 1) {
        setCosmicTimePosition((time) => clamp(time - delta, 0, COSMIC_EPOCHS.length - 1));
        return SCALES.length - 1;
      }
      return proposed;
    });
  };

  const selectDate = (date: Date) => {
    setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12));
    setCalendarAnchor(new Date(date));
    setLive(false);
  };

  const returnToNow = () => {
    const now = new Date();
    setSelectedDate(now);
    setCalendarAnchor(now);
    setCosmicTimePosition(PRESENT_EPOCH_INDEX);
    setLive(true);
  };

  return (
    <section
      className={classNames('cosmic-calendar', className)}
      data-scale={activeScale.key}
      aria-label="Cosmic Calendar"
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') changeScaleOrTime(-0.16);
        if (event.key === 'ArrowDown') changeScaleOrTime(0.16);
      }}
    >
      <header className="cc-header">
        <div className="cc-brand">
          <span className="cc-brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <p className="cc-kicker">COSMIC CALENDAR / LOCAL OBSERVATORY</p>
            <h1>This moment has coordinates.</h1>
          </div>
        </div>
        <div className="cc-header-meta">
          <time dateTime={selectedDate.toISOString()}>
            <strong>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(selectedDate)}</strong>
            <span>{selectedDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {live ? 'LIVE' : 'SELECTED'}</span>
          </time>
          <button type="button" className="cc-location-button" aria-expanded={locationOpen} onClick={() => setLocationOpen((open) => !open)}>
            <span aria-hidden="true">⌖</span>
            <span><strong>{location.label}</strong><small>{formatCoordinate(location.latitude, 'N', 'S')} · {formatCoordinate(location.longitude, 'E', 'W')}</small></span>
          </button>
        </div>
      </header>

      {locationOpen && (
        <LocationEditor
          location={location}
          onSave={(next) => { setLocation(next); setLocationOpen(false); }}
          onDeviceLocation={requestDeviceLocation}
          error={error}
        />
      )}

      <div className="cc-observatory">
        <div className="cc-canvas-shell">
          <CosmicCanvas
            horizon={horizon}
            lunar={lunar}
            solar={solar}
            stars={stars}
            scalePosition={scalePosition}
            cosmicAgeYears={cosmicAgeYears}
            live={live}
            reducedMotion={reducedMotion}
            onWheel={changeScaleOrTime}
          />
          <div className="cc-scene-overlay" aria-live="polite">
            <div>
              <p className="cc-kicker">SCALE {activeScale.short} / {SCALES.length.toString().padStart(2, '0')}</p>
              <h2>{activeScale.title}</h2>
              <p>{activeScale.description}</p>
            </div>
            <p className="cc-scroll-hint"><span>↕</span> Scroll up to move inward · down to move outward</p>
          </div>
          <div className="cc-coordinate-strip">
            <span><i className="cc-dot cc-dot-sun" /> SUN ALT {formatAltitude(horizon.sun.altitudeDegrees)} / AZ {formatAzimuth(horizon.sun.azimuthDegrees)}</span>
            <span><i className="cc-dot cc-dot-moon" /> MOON ALT {formatAltitude(horizon.moon.altitudeDegrees)} / {Math.round(horizon.moon.illuminatedFraction * 100)}% LIT</span>
            <span><i className="cc-dot cc-dot-core" /> CORE ALT {formatAltitude(horizon.galacticCenter.altitudeDegrees)}</span>
          </div>
        </div>

        <nav className="cc-scale-rail" aria-label="Cosmic scales">
          {SCALES.map((scale, index) => (
            <button
              type="button"
              key={scale.key}
              className={classNames('cc-scale-card', activeScaleIndex === index && 'is-active')}
              aria-current={activeScaleIndex === index ? 'step' : undefined}
              onClick={() => setScalePosition(index)}
            >
              <span className={`cc-miniature cc-miniature-${index}`} aria-hidden="true"><i /><i /><i /></span>
              <span className="cc-scale-copy"><small>{scale.short}</small><strong>{scale.title}</strong><em>{scale.description}</em></span>
            </button>
          ))}
        </nav>
      </div>

      <section className="cc-time-console" aria-labelledby="cosmic-time-heading">
        <div className="cc-time-copy">
          <p className="cc-kicker" id="cosmic-time-heading">COSMIC TIME / LOGARITHMIC MODEL</p>
          <h2>{activeEpoch.label}</h2>
          <p>{activeEpoch.detail}</p>
        </div>
        <div className="cc-time-control">
          <div className="cc-time-readout"><strong>{formatCosmicAge(cosmicAgeYears)}</strong><span>{activeEpoch.key === 'present' ? 'NOW' : 'MODELLED EPOCH'}</span></div>
          <input
            type="range"
            min="0"
            max={COSMIC_EPOCHS.length - 1}
            step="0.01"
            value={cosmicTimePosition}
            aria-label="Cosmic time from inflation to heat death"
            onChange={(event) => { setCosmicTimePosition(Number(event.target.value)); setLive(false); }}
          />
          <div className="cc-time-ends"><span>BIG BANG + INFLATION</span><span>HEAT DEATH</span></div>
        </div>
        <button type="button" className="cc-now-button" onClick={returnToNow}>Return to now</button>
      </section>

      <div className="cc-lower-grid">
        <section className="cc-calendar-panel" aria-labelledby="month-heading">
          <header>
            <div><p className="cc-kicker">EARTH CALENDAR / LUNAR LIGHT</p><h2 id="month-heading">{formatMonthTitle(calendarAnchor)}</h2></div>
            <div className="cc-month-actions">
              <button type="button" aria-label="Previous month" onClick={() => setCalendarAnchor(new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() - 1, 1))}>←</button>
              <button type="button" onClick={returnToNow}>Today</button>
              <button type="button" aria-label="Next month" onClick={() => setCalendarAnchor(new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() + 1, 1))}>→</button>
            </div>
          </header>
          <div className="cc-weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="cc-month-grid">
            {calendarDays.map((day) => {
              const selected = day.date.getFullYear() === selectedDate.getFullYear() && day.date.getMonth() === selectedDate.getMonth() && day.date.getDate() === selectedDate.getDate();
              return (
                <button
                  type="button"
                  key={day.date.toISOString()}
                  className={classNames(!day.inMonth && 'is-outside', day.isToday && 'is-today', selected && 'is-selected')}
                  aria-label={`${day.date.toDateString()}, Moon ${Math.round(day.moonIlluminatedFraction * 100)} percent illuminated`}
                  aria-pressed={selected}
                  onClick={() => selectDate(day.date)}
                >
                  <span>{day.date.getDate()}</span>
                  <MoonGlyph fraction={day.moonIlluminatedFraction} phase={day.moonPhaseDegrees} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="cc-distance-panel" aria-labelledby="distance-heading">
          <header><p className="cc-kicker">PATH LENGTH / SINCE FORMATION</p><h2 id="distance-heading">You have never been still.</h2></header>
          <div className="cc-metrics">
            {distanceMetrics.map((metric) => (
              <details key={metric.key}>
                <summary>
                  <span><strong>{metric.label}</strong><small>{metric.currentSpeedKmPerSecond.toFixed(metric.currentSpeedKmPerSecond < 0.01 ? 5 : 2)} km/s now</small></span>
                  <span className="cc-metric-value">{formatCosmicDistance(metric.distanceKm)}{metric.cmbFrameDistanceKm && <small>({formatCosmicDistance(metric.cmbFrameDistanceKm)} CMB-frame model)</small>}</span>
                </summary>
                <p>{metric.method} Historical rates are not fully recoverable; values are transparent present-rate-equivalent models, not falsely exact odometers.</p>
              </details>
            ))}
          </div>
          <p className="cc-method-note">CMB values add hierarchical path lengths as a model; vectors and changing rates prevent a unique multi-billion-year trajectory. Open a row for assumptions.</p>
        </section>
      </div>

      <footer className="cc-footer">
        <span>EPHEMERIS · ASTRONOMY ENGINE / VSOP87 + IAU ROTATION</span>
        <span>MODEL BOUNDS · 3000 BCE—3000 CE FOR PLANETARY VIEWS</span>
        <a href="https://github.com/chensational/CosmicCalendar#scientific-scope" target="_blank" rel="noreferrer">Methods & sources ↗</a>
      </footer>
    </section>
  );
}
