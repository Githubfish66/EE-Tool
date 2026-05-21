export const micro = 1e-6;
export const nano = 1e-9;

export function nC(value: number): number {
  return value * nano;
}

export function uA(value: number): number {
  return value * micro;
}

export function mA(value: number): number {
  return value * 1e-3;
}

export function nF(value: number): number {
  return value * nano;
}

export function uF(value: number): number {
  return value * micro;
}

export function kHz(value: number): number {
  return value * 1e3;
}

export function us(value: number): number {
  return value * micro;
}

export function toNanoFarads(value: number): number {
  return value / nano;
}

export function toMicroFarads(value: number): number {
  return value / micro;
}

export function toNanoCoulombs(value: number): number {
  return value / nano;
}

export function formatCapacitance(farads: number): string {
  if (!Number.isFinite(farads)) {
    return "Invalid";
  }
  if (farads >= micro) {
    return `${toMicroFarads(farads).toFixed(3)} uF`;
  }
  return `${toNanoFarads(farads).toFixed(2)} nF`;
}

export function formatCharge(coulombs: number): string {
  return `${toNanoCoulombs(coulombs).toFixed(2)} nC`;
}

export function formatVoltage(volts: number): string {
  return `${volts.toFixed(3)} V`;
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function formatResistance(ohms: number): string {
  if (!Number.isFinite(ohms)) {
    return "Invalid";
  }
  if (Math.abs(ohms) >= 1e6) {
    return `${(ohms / 1e6).toFixed(3)} Mohm`;
  }
  if (Math.abs(ohms) >= 1e3) {
    return `${(ohms / 1e3).toFixed(3)} kohm`;
  }
  return `${ohms.toFixed(2)} ohm`;
}

export function formatFrequency(hertz: number): string {
  if (!Number.isFinite(hertz)) {
    return "Invalid";
  }
  if (Math.abs(hertz) >= 1e6) {
    return `${(hertz / 1e6).toFixed(3)} MHz`;
  }
  if (Math.abs(hertz) >= 1e3) {
    return `${(hertz / 1e3).toFixed(3)} kHz`;
  }
  return `${hertz.toFixed(2)} Hz`;
}

export function formatGainDb(db: number): string {
  if (!Number.isFinite(db)) {
    return "Invalid";
  }
  return `${db.toFixed(2)} dB`;
}

export function formatPhaseDeg(degrees: number): string {
  if (!Number.isFinite(degrees)) {
    return "Invalid";
  }
  return `${degrees.toFixed(1)} deg`;
}
