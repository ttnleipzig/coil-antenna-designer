/**
 * Antenna calculation utilities
 * All physics models are simplified approximations suitable for visualization.
 */

import type { AntennaParams, AntennaCalcs, VSWRPoint, Preset } from '../types';

/** Speed of light in m/s */
const C = 3e8;

/**
 * Calculates the free-space wavelength for a given frequency.
 * λ = c / f
 */
export function calcWavelength(frequencyMHz: number): number {
  return C / (frequencyMHz * 1e6);
}

/**
 * Derives the number of turns from wire length and coil circumference.
 * turns = wireLength / (π * coilDiameter_m)
 */
export function calcTurns(wireLengthM: number, coilDiameterMm: number): number {
  const circumference = Math.PI * (coilDiameterMm / 1000);
  if (circumference <= 0) return 0;
  return Math.max(1, wireLengthM / circumference);
}

/**
 * Calculates the pitch (axial spacing between turns).
 * For a helical antenna: pitch ≈ λ / 4 * turns  (simplified)
 * Here we use a fraction of the coil diameter as a sensible default.
 */
export function calcPitch(coilDiameterMm: number, frequencyMHz: number): number {
  // Pitch is roughly proportional to wavelength, scaled to the coil
  const wavelengthMm = (C / (frequencyMHz * 1e6)) * 1000;
  // Clamp to a tighter default (3 % λ, max 0.45 × diameter) so the
  // visualized turns stay close and don't appear unnaturally spread apart.
  return Math.min(wavelengthMm * 0.03, coilDiameterMm * 0.45);
}

/**
 * Approximate resonant frequency of a helical coil.
 * Based on Wheeler's formula: f_res ≈ c / (turns * π * diameter)  (very simplified)
 */
export function calcResonantFrequency(turns: number, coilDiameterMm: number): number {
  const coilCircumferenceM = Math.PI * (coilDiameterMm / 1000);
  if (turns <= 0 || coilCircumferenceM <= 0) return 0;
  return (C / (turns * coilCircumferenceM)) / 1e6; // MHz
}

/**
 * Conductivity factor for the wire material (relative to copper).
 * Affects the Q-factor and VSWR bandwidth.
 */
export function materialQFactor(material: AntennaParams['material']): number {
  switch (material) {
    case 'silver':
      return 1.05;
    case 'copper':
      return 1.0;
    case 'aluminum':
      return 0.61;
  }
}

/**
 * Runs all calculations and returns an AntennaCalcs object.
 */
export function calcAntenna(params: AntennaParams): AntennaCalcs {
  const wavelength = calcWavelength(params.frequency);
  const turns = calcTurns(params.wireLength, params.coilDiameter);
  const pitch = calcPitch(params.coilDiameter, params.frequency);
  const resonantFrequency = calcResonantFrequency(turns, params.coilDiameter);
  const coilLength = turns * pitch;

  return { wavelength, turns, pitch, resonantFrequency, coilLength };
}

/**
 * Generates a simulated VSWR curve over a ±20 % frequency range.
 *
 * VSWR approximation:
 *   VSWR(f) = 1 + k / (1 + Q² * ((f/f0)² - 1)²)
 *
 * where:
 *   f0 = resonant frequency
 *   Q  = quality factor (affected by material and geometry)
 *   k  = offset to keep minimum VSWR above 1.0
 */
export function generateVSWR(params: AntennaParams, calcs: AntennaCalcs, points = 100): VSWRPoint[] {
  const { frequency } = params;
  const f0 = calcs.resonantFrequency > 0 ? calcs.resonantFrequency : frequency;
  const Q = 10 * materialQFactor(params.material) * Math.sqrt(calcs.turns);
  const fMin = frequency * 0.8;
  const fMax = frequency * 1.2;
  const step = (fMax - fMin) / (points - 1);

  return Array.from({ length: points }, (_, i) => {
    const f = fMin + i * step;
    const normalised = f / f0;
    // Lorentzian-style resonance curve
    const denom = 1 + Q * Q * Math.pow(normalised * normalised - 1, 2);
    const vswr = 1 + 10 / denom;
    return { frequency: parseFloat(f.toFixed(3)), vswr: parseFloat(vswr.toFixed(3)) };
  });
}

/** Built-in presets covering common ISM/amateur bands */
export const PRESETS: Preset[] = [
  {
    label: '433 MHz',
    params: {
      frequency: 433,
      wireThickness: 1.5,
      wireLength: 0.69,
      material: 'copper',
      coilDiameter: 20,
      targetGain: 2,
    },
  },
  {
    label: '868 MHz',
    params: {
      frequency: 868,
      wireThickness: 1.0,
      wireLength: 0.35,
      material: 'copper',
      coilDiameter: 12,
      targetGain: 3,
    },
  },
  {
    label: '2.4 GHz',
    params: {
      frequency: 2400,
      wireThickness: 0.5,
      wireLength: 0.125,
      material: 'copper',
      coilDiameter: 5,
      targetGain: 4,
    },
  },
];
