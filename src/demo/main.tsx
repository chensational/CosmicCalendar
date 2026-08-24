import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CosmicCalendar } from '../components/CosmicCalendar';
import '../styles/cosmic-calendar.css';
import './demo.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="demo-shell">
      <CosmicCalendar />
      <p className="demo-coda">Every coordinate is temporary. The experience of noticing it is yours.</p>
    </main>
  </StrictMode>,
);
