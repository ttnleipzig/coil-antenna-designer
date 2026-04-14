import React from 'react';
import { useAntennaStore } from '../store/antennaStore';
import { PRESETS } from '../utils/calculations';

/**
 * Preset selection buttons – allow one-click loading of common configurations.
 */
const PresetButtons: React.FC = () => {
  const applyPreset = useAntennaStore((s) => s.applyPreset);

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <span className="text-sm font-medium self-center text-gray-500 dark:text-gray-400">
        Presets:
      </span>
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          onClick={() => applyPreset(preset.params)}
          className="px-3 py-1 text-xs rounded-full border border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
};

export default PresetButtons;
