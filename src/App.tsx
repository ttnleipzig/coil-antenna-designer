import React, { useEffect } from 'react';
import InputForm from './components/InputForm';
import CanvasRenderer from './components/CanvasRenderer';
import VSWRChart from './components/VSWRChart';
import DarkModeToggle from './components/DarkModeToggle';
import { useAntennaStore } from './store/antennaStore';

/**
 * App – root component.
 *
 * Layout (desktop):
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  Header (title + dark-mode toggle)                      │
 *   ├──────────────┬──────────────────────────────────────────┤
 *   │  Input Form  │  Coil Visualization (Canvas)             │
 *   │  (left)      ├──────────────────────────────────────────┤
 *   │              │  VSWR Chart (Chart.js)                   │
 *   └──────────────┴──────────────────────────────────────────┘
 *
 * On mobile the panels stack vertically.
 */
const App: React.FC = () => {
  const darkMode = useAntennaStore((s) => s.darkMode);

  // Apply/remove the "dark" class on <html> when the store changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Antenna SVG icon */}
          <svg
            className="h-7 w-7 text-indigo-600 dark:text-indigo-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path strokeLinecap="round" d="M12 2 L12 22" />
            <path strokeLinecap="round" d="M7 6 Q12 10 17 6" />
            <path strokeLinecap="round" d="M5 10 Q12 15 19 10" />
            <path strokeLinecap="round" d="M3 14 Q12 20 21 14" />
          </svg>
          <div>
            <h1 className="text-lg font-bold leading-tight text-indigo-700 dark:text-indigo-400">
              Coil Antenna Designer
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
              Interactive helical antenna design &amp; simulation tool
            </p>
          </div>
        </div>
        <DarkModeToggle />
      </header>

      {/* ── Main layout ─────────────────────────────────────── */}
      <main className="flex flex-col lg:flex-row h-[calc(100vh-57px)] overflow-hidden">
        {/* Left panel – input form */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
          <InputForm />
        </div>

        {/* Right panel – visualization + chart */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top: canvas */}
          <div className="flex-1 min-h-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CanvasRenderer />
          </div>

          {/* Bottom: VSWR chart */}
          <div className="h-64 lg:h-72 shrink-0 bg-white dark:bg-gray-800">
            <VSWRChart />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
