/** Antenna design parameters controlled by the input form */
export interface AntennaParams {
  /** Frequency in MHz */
  frequency: number;
  /** Wire thickness in mm */
  wireThickness: number;
  /** Wire length in meters */
  wireLength: number;
  /** Wire material */
  material: 'copper' | 'aluminum' | 'silver';
  /** Coil diameter in mm */
  coilDiameter: number;
  /** Target gain in dBi */
  targetGain: number;
}

/** Derived antenna calculations */
export interface AntennaCalcs {
  /** Wavelength in meters */
  wavelength: number;
  /** Number of coil turns */
  turns: number;
  /** Coil pitch (spacing between turns) in mm */
  pitch: number;
  /** Approximate resonant frequency in MHz */
  resonantFrequency: number;
  /** Axial length of the coil in mm */
  coilLength: number;
}

/** A single VSWR data point */
export interface VSWRPoint {
  frequency: number;
  vswr: number;
}

/** Preset configuration */
export interface Preset {
  label: string;
  params: Partial<AntennaParams>;
}
