/**
 * Zustand store – single source of truth for antenna design parameters,
 * derived calculations, and UI state (dark mode).
 */
import { create } from 'zustand';
import type { AntennaParams, AntennaCalcs } from '../types';
import { calcAntenna } from '../utils/calculations';

interface AntennaStore {
  params: AntennaParams;
  calcs: AntennaCalcs;
  darkMode: boolean;
  setParam: <K extends keyof AntennaParams>(key: K, value: AntennaParams[K]) => void;
  applyPreset: (partial: Partial<AntennaParams>) => void;
  toggleDarkMode: () => void;
}

const defaultParams: AntennaParams = {
  frequency: 433,
  wireThickness: 1.5,
  wireLength: 0.69,
  material: 'copper',
  coilDiameter: 20,
  targetGain: 2,
};

export const useAntennaStore = create<AntennaStore>((set) => ({
  params: defaultParams,
  calcs: calcAntenna(defaultParams),
  darkMode: false,

  setParam: (key, value) =>
    set((state) => {
      const params = { ...state.params, [key]: value };
      return { params, calcs: calcAntenna(params) };
    }),

  applyPreset: (partial) =>
    set((state) => {
      const params = { ...state.params, ...partial };
      return { params, calcs: calcAntenna(params) };
    }),

  toggleDarkMode: () =>
    set((state) => ({ darkMode: !state.darkMode })),
}));
