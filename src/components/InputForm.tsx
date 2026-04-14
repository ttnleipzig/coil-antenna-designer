import React from 'react';
import { useAntennaStore } from '../store/antennaStore';
import PresetButtons from './PresetButtons';
import type { AntennaParams } from '../types';

interface FieldProps {
  label: string;
  unit?: string;
  children: React.ReactNode;
}

/** Wrapper providing a consistent label + unit badge layout */
const Field: React.FC<FieldProps> = ({ label, unit, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
      {unit && (
        <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">({unit})</span>
      )}
    </label>
    {children}
  </div>
);

const inputCls =
  'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition';

/**
 * InputForm – controlled form component for all antenna design parameters.
 * Updates the Zustand store on every change, which triggers live re-renders.
 */
const InputForm: React.FC = () => {
  const params = useAntennaStore((s) => s.params);
  const calcs = useAntennaStore((s) => s.calcs);
  const setParam = useAntennaStore((s) => s.setParam);

  const handleNumber =
    (key: keyof AntennaParams) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) setParam(key, val as never);
    };

  const handleSelect =
    (key: keyof AntennaParams) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      setParam(key, e.target.value as never);
    };

  return (
    <aside className="flex flex-col gap-4 p-4 overflow-y-auto">
      <PresetButtons />

      <div className="grid grid-cols-1 gap-4">
        <Field label="Frequency" unit="MHz">
          <input
            type="number"
            min={1}
            max={10000}
            step={0.1}
            value={params.frequency}
            onChange={handleNumber('frequency')}
            className={inputCls}
          />
        </Field>

        <Field label="Wire Thickness" unit="mm">
          <input
            type="number"
            min={0.1}
            max={10}
            step={0.1}
            value={params.wireThickness}
            onChange={handleNumber('wireThickness')}
            className={inputCls}
          />
        </Field>

        <Field label="Wire Length" unit="m">
          <input
            type="number"
            min={0.01}
            max={100}
            step={0.01}
            value={params.wireLength}
            onChange={handleNumber('wireLength')}
            className={inputCls}
          />
        </Field>

        <Field label="Wire Material">
          <select
            value={params.material}
            onChange={handleSelect('material')}
            className={inputCls}
          >
            <option value="copper">Copper</option>
            <option value="aluminum">Aluminum</option>
            <option value="silver">Silver</option>
          </select>
        </Field>

        <Field label="Coil Diameter" unit="mm">
          <input
            type="number"
            min={1}
            max={500}
            step={1}
            value={params.coilDiameter}
            onChange={handleNumber('coilDiameter')}
            className={inputCls}
          />
        </Field>

        <Field label="Target Gain" unit="dBi">
          <input
            type="number"
            min={-10}
            max={30}
            step={0.5}
            value={params.targetGain}
            onChange={handleNumber('targetGain')}
            className={inputCls}
          />
        </Field>
      </div>

      {/* Derived calculations summary */}
      <div className="mt-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 p-3 text-sm space-y-1">
        <p className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Calculated Values</p>
        <Row label="Wavelength" value={`${(calcs.wavelength * 100).toFixed(1)} cm`} />
        <Row label="Turns" value={calcs.turns.toFixed(1)} />
        <Row label="Pitch" value={`${calcs.pitch.toFixed(1)} mm`} />
        <Row label="Coil length" value={`${calcs.coilLength.toFixed(1)} mm`} />
        <Row label="Resonant freq." value={`${calcs.resonantFrequency.toFixed(2)} MHz`} />
      </div>
    </aside>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between text-xs">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{value}</span>
  </div>
);

export default InputForm;
