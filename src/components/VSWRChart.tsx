import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAntennaStore } from '../store/antennaStore';
import { generateVSWR } from '../utils/calculations';

// Register Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

/**
 * VSWRChart – renders a simulated VSWR vs. frequency curve using Chart.js.
 *
 * A vertical annotation highlights the user-selected operating frequency.
 * VSWR below 2 is generally considered acceptable; that zone is shaded.
 */
const VSWRChart: React.FC = () => {
  const params = useAntennaStore((s) => s.params);
  const calcs = useAntennaStore((s) => s.calcs);
  const darkMode = useAntennaStore((s) => s.darkMode);

  const vswrPoints = useMemo(
    () => generateVSWR(params, calcs),
    [params, calcs],
  );

  const labels = vswrPoints.map((p) => p.frequency.toFixed(1));
  const values = vswrPoints.map((p) => p.vswr);

  // Find index closest to the selected frequency
  const closestIdx = vswrPoints.reduce(
    (best, p, i) =>
      Math.abs(p.frequency - params.frequency) <
      Math.abs(vswrPoints[best].frequency - params.frequency)
        ? i
        : best,
    0,
  );

  const textColour = darkMode ? '#e2e8f0' : '#1e293b';
  const gridColour = darkMode ? '#334155' : '#e2e8f0';

  const data = {
    labels,
    datasets: [
      {
        label: 'VSWR',
        data: values,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.12)',
        borderWidth: 2,
        pointRadius: values.map((_, i) => (i === closestIdx ? 6 : 0)),
        pointBackgroundColor: values.map((_, i) =>
          i === closestIdx ? '#f59e0b' : '#6366f1',
        ),
        pointBorderColor: values.map((_, i) =>
          i === closestIdx ? '#d97706' : '#6366f1',
        ),
        pointBorderWidth: 2,
        fill: true,
        tension: 0.4,
      },
      // VSWR = 2 threshold line
      {
        label: 'VSWR = 2 threshold',
        data: Array(values.length).fill(2),
        borderColor: '#f87171',
        borderWidth: 1.5,
        borderDash: [6, 3],
        pointRadius: 0,
        fill: false,
        tension: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 } as const,
    plugins: {
      legend: {
        labels: { color: textColour, boxWidth: 14, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) =>
            ` VSWR: ${(ctx.parsed.y ?? 0).toFixed(2)}`,
        },
      },
      title: {
        display: true,
        text: `VSWR vs. Frequency  (operating: ${params.frequency} MHz)`,
        color: textColour,
        font: { size: 12 },
      },
    },
    scales: {
      x: {
        ticks: {
          color: textColour,
          maxTicksLimit: 8,
          font: { size: 10 },
          callback: (_val: unknown, idx: number) =>
            idx % Math.floor(vswrPoints.length / 8) === 0
              ? labels[idx]
              : '',
        },
        grid: { color: gridColour },
        title: {
          display: true,
          text: 'Frequency (MHz)',
          color: textColour,
          font: { size: 11 },
        },
      },
      y: {
        min: 1,
        max: Math.min(12, Math.max(3, Math.ceil(Math.max(...values) + 0.5))),
        ticks: { color: textColour, font: { size: 10 } },
        grid: { color: gridColour },
        title: {
          display: true,
          text: 'VSWR',
          color: textColour,
          font: { size: 11 },
        },
      },
    },
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300">
          VSWR Chart
        </h2>
      </div>
      <div className="flex-1 min-h-0 p-2">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default VSWRChart;
