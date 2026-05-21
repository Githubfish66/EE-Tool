import {
  formatCapacitance,
  formatFrequency,
  formatGainDb,
  formatPhaseDeg,
  formatResistance,
} from "./units";
import type { FormulaLine, Message } from "./bootstrapCalculator";

export type CompensatorType = "type1" | "type2" | "type3";
export type CompensatorDesignMode = "auto" | "manual";

export type BodePoint = {
  frequency: number;
  gainDb: number;
  phaseDeg: number;
};

export type CompensatorInputs = {
  bodePoints: BodePoint[];
  compensatorType: CompensatorType;
  designMode: CompensatorDesignMode;
  crossoverFrequency: number;
  targetPhaseMargin?: number;
  r1: number;
  resonantFrequency?: number;
  switchingFrequency?: number;
  originPoleFrequency?: number;
  zeroFrequency?: number;
  poleFrequency?: number;
  zeroFrequency1?: number;
  zeroFrequency2?: number;
  poleFrequency1?: number;
  poleFrequency2?: number;
};

export type CompensatorComponent = {
  label: string;
  ideal: number;
  recommended: number;
  unit: "resistance" | "capacitance";
};

export type CompensatorBodePoint = {
  frequency: number;
  magnitudeDb: number;
  phaseDeg: number;
};

export type LoopStabilityMetrics = {
  gainCrossoverFrequency: number | null;
  phaseAtGainCrossover: number | null;
  phaseMarginDeg: number | null;
  phaseCrossoverFrequency: number | null;
  gainAtPhaseCrossoverDb: number | null;
  gainMarginDb: number | null;
};

export type CompensatorResult = {
  compensatorType: CompensatorType;
  crossoverFrequency: number;
  targetPhaseMargin: number | null;
  estimatedPhaseMargin: number;
  plantGainDb: number;
  plantPhaseDeg: number;
  gainAtCrossover: number;
  originPoleFrequency: number | null;
  requiredPhaseBoostDeg: number;
  kFactor: number;
  designMode: CompensatorDesignMode;
  zeros: number[];
  poles: number[];
  components: CompensatorComponent[];
  plantBode: CompensatorBodePoint[];
  compensatorBode: CompensatorBodePoint[];
  loopGainBode: CompensatorBodePoint[];
  stabilityMargins: LoopStabilityMetrics;
  bodeSummary: {
    count: number;
    minFrequency: number;
    maxFrequency: number;
  };
  lines: FormulaLine[];
  messages: Message[];
};

export type ParseResult = {
  points: BodePoint[];
  messages: Message[];
};

const E24 = [
  1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9,
  4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
];

const E96 = [
  1, 1.02, 1.05, 1.07, 1.1, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.3,
  1.33, 1.37, 1.4, 1.43, 1.47, 1.5, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74,
  1.78, 1.82, 1.87, 1.91, 1.96, 2, 2.05, 2.1, 2.15, 2.21, 2.26, 2.32,
  2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.8, 2.87, 2.94, 3.01, 3.09,
  3.16, 3.24, 3.32, 3.4, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12,
  4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49,
  5.62, 5.76, 5.9, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98, 7.15, 7.32,
  7.5, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76,
];

export function parseBodeCsv(csv: string): ParseResult {
  const messages: Message[] = [];
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    return {
      points: [],
      messages: [{ severity: "danger", text: "CSV must include a header and at least two data rows." }],
    };
  }

  const header = rows[0].split(",").map((cell) => cell.trim().toLowerCase());
  const freqIndex = header.indexOf("freq");
  const gainIndex = header.indexOf("gain");
  const phaseIndex = header.indexOf("phase");
  if (freqIndex < 0 || gainIndex < 0 || phaseIndex < 0) {
    return {
      points: [],
      messages: [{ severity: "danger", text: "CSV header must contain freq,gain,phase columns." }],
    };
  }

  const points: BodePoint[] = [];
  rows.slice(1).forEach((row, rowIndex) => {
    const cells = row.split(",").map((cell) => cell.trim());
    const frequency = Number(cells[freqIndex]);
    const gainDb = Number(cells[gainIndex]);
    const phaseDeg = Number(cells[phaseIndex]);
    if (!Number.isFinite(frequency) || !Number.isFinite(gainDb) || !Number.isFinite(phaseDeg)) {
      messages.push({
        severity: "danger",
        text: `CSV row ${rowIndex + 2} contains a non-numeric value.`,
      });
      return;
    }
    if (frequency <= 0) {
      messages.push({
        severity: "danger",
        text: `CSV row ${rowIndex + 2} frequency must be greater than zero.`,
      });
      return;
    }
    points.push({ frequency, gainDb, phaseDeg });
  });

  const sorted = points.sort((a, b) => a.frequency - b.frequency);
  if (sorted.length < 2) {
    messages.push({ severity: "danger", text: "CSV must provide at least two valid Bode points." });
  }
  return { points: sorted, messages };
}

export function interpolateBode(points: BodePoint[], frequency: number): BodePoint {
  if (points.length === 0) {
    return { frequency, gainDb: Number.NaN, phaseDeg: Number.NaN };
  }
  if (frequency <= points[0].frequency) {
    return { ...points[0], frequency };
  }
  const last = points[points.length - 1];
  if (frequency >= last.frequency) {
    return { ...last, frequency };
  }
  const upperIndex = points.findIndex((point) => point.frequency >= frequency);
  const low = points[Math.max(upperIndex - 1, 0)];
  const high = points[upperIndex];
  const span = Math.log10(high.frequency) - Math.log10(low.frequency);
  const ratio = (Math.log10(frequency) - Math.log10(low.frequency)) / span;
  return {
    frequency,
    gainDb: low.gainDb + (high.gainDb - low.gainDb) * ratio,
    phaseDeg: low.phaseDeg + (high.phaseDeg - low.phaseDeg) * ratio,
  };
}

export function calculateCompensator(input: CompensatorInputs): CompensatorResult {
  const messages: Message[] = [];
  const points = [...input.bodePoints].sort((a, b) => a.frequency - b.frequency);
  if (points.length < 2) {
    messages.push({ severity: "danger", text: "Import at least two valid Bode points before analysis." });
  }
  assertPositive(input.crossoverFrequency, "f_C", messages);
  if (input.designMode === "auto" && input.compensatorType !== "type1") {
    assertPositive(input.targetPhaseMargin ?? Number.NaN, "PM_TARGET", messages);
  }
  assertPositive(input.r1, "R1", messages);
  assertManualInputs(input, messages);
  if (input.compensatorType === "type3") {
    if (input.resonantFrequency !== undefined) {
      assertPositive(input.resonantFrequency, "f_0", messages);
    }
    if (input.switchingFrequency !== undefined) {
      assertPositive(input.switchingFrequency, "f_SW", messages);
    }
  }

  const summary = {
    count: points.length,
    minFrequency: points[0]?.frequency ?? Number.NaN,
    maxFrequency: points[points.length - 1]?.frequency ?? Number.NaN,
  };
  if (
    Number.isFinite(input.crossoverFrequency) &&
    (input.crossoverFrequency < summary.minFrequency || input.crossoverFrequency > summary.maxFrequency)
  ) {
    messages.push({
      severity: "danger",
      text: "Target crossover frequency is outside the imported Bode data range.",
    });
  }

  const plant = interpolateBode(points, input.crossoverFrequency);
  const gainAtCrossover = dbToLinear(-plant.gainDb);
  const originPoleFrequency =
    input.compensatorType === "type1"
      ? input.designMode === "manual"
        ? input.originPoleFrequency ?? Number.NaN
        : gainAtCrossover * input.crossoverFrequency
      : null;
  const estimatedPhaseMargin = 90 + plant.phaseDeg;
  const requiredCompensatorPhase =
    input.designMode === "manual" || input.compensatorType === "type1"
      ? -90
      : (input.targetPhaseMargin ?? Number.NaN) - 180 - plant.phaseDeg;
  const requiredPhaseBoostDeg =
    input.designMode === "manual"
      ? manualPhaseBoost(input)
      : input.compensatorType === "type1"
        ? 0
        : Math.max(0, requiredCompensatorPhase + 90);
  const maxBoost = getMaxBoost(input.compensatorType);
  if (requiredPhaseBoostDeg > maxBoost) {
    messages.push({
      severity: "danger",
      text: `${labelType(input.compensatorType)} cannot provide the required ${requiredPhaseBoostDeg.toFixed(1)} deg phase boost with the Chapter 5 non-isolated op amp topology.`,
    });
  }
  if (input.compensatorType === "type1") {
    messages.push({
      severity: estimatedPhaseMargin < 45 ? "warning" : "info",
      text: `Type I has only an origin pole and no phase boost parameter. Estimated phase margin at f_C is ${estimatedPhaseMargin.toFixed(1)} deg.`,
    });
  }

  const network =
    input.designMode === "manual"
      ? synthesizeManualNetwork({
        type: input.compensatorType,
        frequency: input.crossoverFrequency,
        gain: gainAtCrossover,
        r1: input.r1,
        originPoleFrequency: input.originPoleFrequency,
        zeroFrequency: input.zeroFrequency,
        poleFrequency: input.poleFrequency,
        zeroFrequency1: input.zeroFrequency1,
        zeroFrequency2: input.zeroFrequency2,
        poleFrequency1: input.poleFrequency1,
        poleFrequency2: input.poleFrequency2,
      })
      : synthesizeKFactorNetwork({
        type: input.compensatorType,
        frequency: input.crossoverFrequency,
        gain: gainAtCrossover,
        boostDeg: Math.min(requiredPhaseBoostDeg, maxBoost),
        r1: input.r1,
      });
  messages.push(...network.messages);
  addType3DesignMessages(input, messages);
  messages.push({
    severity: "info",
    text: "Non-isolated op amp compensator based on Chapter 5 and Appendix 5B k-factor component definitions.",
  });
  const compensatorBode = buildCompensatorBode({
    type: input.compensatorType,
    crossoverFrequency: input.crossoverFrequency,
    gainAtCrossover,
    originPoleFrequency,
    zeros: network.zeros,
    poles: network.poles,
    minFrequency: summary.minFrequency,
    maxFrequency: summary.maxFrequency,
  });
  const plantBode = points.map((point) => ({
    frequency: point.frequency,
    magnitudeDb: point.gainDb,
    phaseDeg: point.phaseDeg,
  }));
  const loopGainBode = compensatorBode.map((compensatorPoint) => {
    const point = interpolateBode(points, compensatorPoint.frequency);
    return {
      frequency: compensatorPoint.frequency,
      magnitudeDb: point.gainDb + compensatorPoint.magnitudeDb,
      phaseDeg: point.phaseDeg + compensatorPoint.phaseDeg,
    };
  });
  const stabilityMargins = calculateStabilityMargins(loopGainBode);

  return {
    compensatorType: input.compensatorType,
    crossoverFrequency: input.crossoverFrequency,
    targetPhaseMargin: input.compensatorType === "type1" ? null : input.targetPhaseMargin ?? Number.NaN,
    estimatedPhaseMargin,
    plantGainDb: plant.gainDb,
    plantPhaseDeg: plant.phaseDeg,
    gainAtCrossover,
    originPoleFrequency,
    requiredPhaseBoostDeg,
    kFactor: network.kFactor,
    designMode: input.designMode,
    zeros: network.zeros,
    poles: network.poles,
    components: network.components,
    plantBode,
    compensatorBode,
    loopGainBode,
    stabilityMargins,
    bodeSummary: summary,
    messages,
    lines: [
      {
        label: "Bode interpolation at crossover",
        expression: "G_PLANT(f_C), PHI_PLANT(f_C)",
        result: `${formatGainDb(plant.gainDb)}, ${formatPhaseDeg(plant.phaseDeg)} at ${formatFrequency(input.crossoverFrequency)}`,
      },
      {
        label: "Required compensator gain",
        expression: "G = 1 / |G_PLANT(f_C)|",
        result: `${formatGainDb(-plant.gainDb)} (${gainAtCrossover.toPrecision(4)} ratio)`,
      },
      {
        label: "Required phase boost",
        expression: "boost = PM_TARGET - 90deg - PHI_PLANT",
        result:
          input.compensatorType === "type1"
            ? "Type I uses no phase-boost design parameter."
            : `${formatPhaseDeg(input.targetPhaseMargin ?? Number.NaN)} - 90 deg - (${formatPhaseDeg(plant.phaseDeg)}) = ${formatPhaseDeg(requiredPhaseBoostDeg)}`,
      },
      {
        label: input.designMode === "manual" ? "Manual pole-zero placement" : "k-factor definition",
        expression: "k = tan(boost / n + 45deg)",
        result: input.designMode === "manual"
          ? "Pole and zero positions are entered directly by the user."
          : `${network.kExpression} = ${network.kFactor.toFixed(4)}`,
      },
      {
        label: input.compensatorType === "type1" ? "Origin pole placement" : "k-factor pole-zero placement",
        expression: "f_Z = f_C / k, f_P = f_C x k",
        result: [
          ...network.zeros.map((zero) => `zero ${formatFrequency(zero)}`),
          ...network.poles.map((pole) => `pole ${formatFrequency(pole)}`),
        ].join(", ") || `f_p0 = ${formatFrequency(originPoleFrequency ?? Number.NaN)}`,
      },
      {
        label: "Component definitions",
        expression: componentFormula(input.compensatorType),
        result: network.components
          .map((item) => `${item.label} = ${formatComponentIdeal(item)}`)
          .join(", "),
      },
    ],
  };
}

function interpolateCompensatorBode(points: CompensatorBodePoint[], frequency: number): CompensatorBodePoint {
  if (points.length === 0) {
    return { frequency, magnitudeDb: Number.NaN, phaseDeg: Number.NaN };
  }
  if (frequency <= points[0].frequency) {
    return { ...points[0], frequency };
  }
  const last = points[points.length - 1];
  if (frequency >= last.frequency) {
    return { ...last, frequency };
  }
  const upperIndex = points.findIndex((point) => point.frequency >= frequency);
  const low = points[Math.max(upperIndex - 1, 0)];
  const high = points[upperIndex];
  const span = Math.log10(high.frequency) - Math.log10(low.frequency);
  const ratio = (Math.log10(frequency) - Math.log10(low.frequency)) / span;
  return {
    frequency,
    magnitudeDb: low.magnitudeDb + (high.magnitudeDb - low.magnitudeDb) * ratio,
    phaseDeg: low.phaseDeg + (high.phaseDeg - low.phaseDeg) * ratio,
  };
}

function calculateStabilityMargins(points: CompensatorBodePoint[]): LoopStabilityMetrics {
  const gainCrossover = findCrossing(points, (point) => point.magnitudeDb, 0);
  const phaseCrossover = findCrossing(points, (point) => point.phaseDeg, -180);
  const phaseAtGainCrossover = gainCrossover
    ? interpolateCompensatorBode(points, gainCrossover.frequency).phaseDeg
    : null;
  const gainAtPhaseCrossover = phaseCrossover
    ? interpolateCompensatorBode(points, phaseCrossover.frequency).magnitudeDb
    : null;

  return {
    gainCrossoverFrequency: gainCrossover?.frequency ?? null,
    phaseAtGainCrossover,
    phaseMarginDeg: phaseAtGainCrossover === null ? null : 180 + phaseAtGainCrossover,
    phaseCrossoverFrequency: phaseCrossover?.frequency ?? null,
    gainAtPhaseCrossoverDb: gainAtPhaseCrossover,
    gainMarginDb: gainAtPhaseCrossover === null ? null : -gainAtPhaseCrossover,
  };
}

function findCrossing(
  points: CompensatorBodePoint[],
  selector: (point: CompensatorBodePoint) => number,
  target: number,
): { frequency: number } | null {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const previousDelta = selector(previous) - target;
    const currentDelta = selector(current) - target;
    if (!Number.isFinite(previousDelta) || !Number.isFinite(currentDelta)) {
      continue;
    }
    if (previousDelta === 0) {
      return { frequency: previous.frequency };
    }
    if (previousDelta * currentDelta <= 0) {
      const logLow = Math.log10(previous.frequency);
      const logHigh = Math.log10(current.frequency);
      const ratio = Math.abs(previousDelta) / Math.max(Math.abs(previousDelta) + Math.abs(currentDelta), 1e-30);
      return { frequency: 10 ** (logLow + (logHigh - logLow) * ratio) };
    }
  }
  return null;
}

function buildCompensatorBode(input: {
  type: CompensatorType;
  crossoverFrequency: number;
  gainAtCrossover: number;
  originPoleFrequency: number | null;
  zeros: number[];
  poles: number[];
  minFrequency: number;
  maxFrequency: number;
}): CompensatorBodePoint[] {
  if (
    !Number.isFinite(input.crossoverFrequency) ||
    !Number.isFinite(input.gainAtCrossover) ||
    input.crossoverFrequency <= 0 ||
    input.gainAtCrossover <= 0
  ) {
    return [];
  }
  const minFrequency = Number.isFinite(input.minFrequency) && input.minFrequency > 0
    ? input.minFrequency
    : input.crossoverFrequency / 100;
  const maxFrequency = Number.isFinite(input.maxFrequency) && input.maxFrequency > minFrequency
    ? input.maxFrequency
    : input.crossoverFrequency * 100;
  const start = Math.max(minFrequency, input.crossoverFrequency / 1000);
  const stop = Math.max(maxFrequency, input.crossoverFrequency * 10);
  const count = 180;
  const shapeAtCrossover = compensatorShapeAt({
    frequency: input.crossoverFrequency,
    zeros: input.zeros,
    poles: input.poles,
  });
  const scale = input.gainAtCrossover / Math.max(shapeAtCrossover.magnitude, 1e-30);

  const frequencies = Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    return 10 ** (Math.log10(start) + ratio * (Math.log10(stop) - Math.log10(start)));
  });
  if (input.crossoverFrequency >= start && input.crossoverFrequency <= stop) {
    frequencies.push(input.crossoverFrequency);
    frequencies.sort((a, b) => a - b);
  }

  return frequencies.map((frequency) => {
    const shape = compensatorShapeAt({
      frequency,
      zeros: input.zeros,
      poles: input.poles,
    });
    return {
      frequency,
      magnitudeDb: linearToDb(scale * shape.magnitude),
      phaseDeg: shape.phaseDeg,
    };
  });
}

function compensatorShapeAt(input: {
  frequency: number;
  zeros: number[];
  poles: number[];
}): {
  magnitude: number;
  phaseDeg: number;
} {
  const omega = 2 * Math.PI * input.frequency;
  const zeroProduct = input.zeros.reduce((product, zero) => {
    if (!Number.isFinite(zero) || zero <= 0) {
      return product;
    }
    return product * Math.sqrt(1 + (input.frequency / zero) ** 2);
  }, 1);
  const poleProduct = input.poles.reduce((product, pole) => {
    if (!Number.isFinite(pole) || pole <= 0) {
      return product;
    }
    return product * Math.sqrt(1 + (input.frequency / pole) ** 2);
  }, 1);
  return {
    magnitude: zeroProduct / Math.max(omega * poleProduct, 1e-30),
    phaseDeg: -90 + phaseBoostAt(input.frequency, input.zeros, input.poles),
  };
}

function synthesizeKFactorNetwork(input: {
  type: CompensatorType;
  frequency: number;
  gain: number;
  boostDeg: number;
  r1: number;
}): {
  kFactor: number;
  kExpression: string;
  zeros: number[];
  poles: number[];
  components: CompensatorComponent[];
  messages: Message[];
} {
  const messages: Message[] = [];
  const wc = 2 * Math.PI * input.frequency;
  const gain = Math.max(input.gain, 1e-12);
  const r1 = input.r1;
  const zeros: number[] = [];
  const poles: number[] = [];
  const components: CompensatorComponent[] = [
    component("R1", r1, recommendE96(r1), "resistance"),
  ];

  if (input.type === "type1") {
    const fp0 = input.frequency * gain;
    const c1 = 1 / (2 * Math.PI * fp0 * r1);
    components.push(component("C1", c1, recommendE24(c1), "capacitance"));
    return finishNetwork({
      kFactor: 1,
      kExpression: "Type I: k = 1",
      zeros,
      poles,
      components,
      messages,
    });
  }

  const kFactor = input.type === "type2"
    ? kFactorType2(input.boostDeg)
    : kFactorType3(input.boostDeg);
  const kSquaredMinusOne = kFactor ** 2 - 1;
  if (kSquaredMinusOne <= 1e-9) {
    messages.push({
      severity: "warning",
      text: `${labelType(input.type)} component equations become ill-conditioned when boost is near 0 deg.`,
    });
  }

  if (input.type === "type2") {
    const c1 = 1 / (wc * gain * r1);
    const r2 = kFactor / (wc * Math.max(c1, 1e-24));
    const c2 = c1 / Math.max(kSquaredMinusOne, 1e-12);
    zeros.push(input.frequency / kFactor);
    poles.push(input.frequency * kFactor);
    components.push(
      component("C1", c1, recommendE24(c1), "capacitance"),
      component("C2", c2, recommendE24(c2), "capacitance"),
      component("R2", r2, recommendE96(r2), "resistance"),
    );
  } else {
    const sqrtK = Math.sqrt(kFactor);
    const c2 = 1 / (wc * r1 * gain);
    const c1 = c2 * Math.max(kFactor - 1, 0);
    const r2 = sqrtK / (wc * Math.max(c1, 1e-24));
    const r3 = r1 / Math.max(kFactor - 1, 1e-12);
    const c3 = 1 / (wc * sqrtK * r3);
    zeros.push(input.frequency / sqrtK, input.frequency / sqrtK);
    poles.push(input.frequency * sqrtK, input.frequency * sqrtK);
    components.push(
      component("C1", c1, recommendE24(c1), "capacitance"),
      component("C2", c2, recommendE24(c2), "capacitance"),
      component("R2", r2, recommendE96(r2), "resistance"),
      component("R3", r3, recommendE96(r3), "resistance"),
      component("C3", c3, recommendE24(c3), "capacitance"),
    );
  }

  return finishNetwork({
    kFactor,
    kExpression:
      input.type === "type2"
        ? "Type II: tan(boost / 2 + 45deg)"
        : "Type III: tan(boost / 4 + 45deg)^2",
    zeros,
    poles,
    components,
    messages,
  });
}

function synthesizeManualNetwork(input: {
  type: CompensatorType;
  frequency: number;
  gain: number;
  r1: number;
  originPoleFrequency?: number;
  zeroFrequency?: number;
  poleFrequency?: number;
  zeroFrequency1?: number;
  zeroFrequency2?: number;
  poleFrequency1?: number;
  poleFrequency2?: number;
}): {
  kFactor: number;
  kExpression: string;
  zeros: number[];
  poles: number[];
  components: CompensatorComponent[];
  messages: Message[];
} {
  const messages: Message[] = [];
  const components: CompensatorComponent[] = [
    component("R1", input.r1, recommendE96(input.r1), "resistance"),
  ];
  if (input.type === "type1") {
    const fp0 = input.originPoleFrequency ?? Number.NaN;
    const c1 = 1 / (2 * Math.PI * fp0 * input.r1);
    components.push(component("C1", c1, recommendE24(c1), "capacitance"));
    return finishNetwork({
      kFactor: 1,
      kExpression: "Manual Type I",
      zeros: [],
      poles: [],
      components,
      messages,
    });
  }
  if (input.type === "type2") {
    const fz = input.zeroFrequency ?? Number.NaN;
    const fp = input.poleFrequency ?? Number.NaN;
    const kFactor = Math.sqrt(fp / fz);
    const c1 = 1 / (2 * Math.PI * input.frequency * input.gain * input.r1);
    const r2 = 1 / (2 * Math.PI * fz * c1);
    const c2 = c1 * fz / (fp - fz);
    components.push(
      component("C1", c1, recommendE24(c1), "capacitance"),
      component("C2", c2, recommendE24(c2), "capacitance"),
      component("R2", r2, recommendE96(r2), "resistance"),
    );
    return finishNetwork({
      kFactor,
      kExpression: "Manual Type II",
      zeros: [fz],
      poles: [fp],
      components,
      messages,
    });
  }

  const fz1 = input.zeroFrequency1 ?? Number.NaN;
  const fz2 = input.zeroFrequency2 ?? Number.NaN;
  const fp1 = input.poleFrequency1 ?? Number.NaN;
  const fp2 = input.poleFrequency2 ?? Number.NaN;
  const fzEquivalent = Math.sqrt(fz1 * fz2);
  const fpEquivalent = Math.sqrt(fp1 * fp2);
  const kFactor = fpEquivalent / fzEquivalent;
  const c2 = 1 / (2 * Math.PI * input.frequency * input.r1 * input.gain);
  const c1 = c2 * Math.max(kFactor - 1, 0);
  const r2 = 1 / (2 * Math.PI * fzEquivalent * Math.max(c1, 1e-24));
  const r3 = input.r1 / Math.max(kFactor - 1, 1e-12);
  const c3 = 1 / (2 * Math.PI * fpEquivalent * r3);
  components.push(
    component("C1", c1, recommendE24(c1), "capacitance"),
    component("C2", c2, recommendE24(c2), "capacitance"),
    component("R2", r2, recommendE96(r2), "resistance"),
    component("R3", r3, recommendE96(r3), "resistance"),
    component("C3", c3, recommendE24(c3), "capacitance"),
  );
  return finishNetwork({
    kFactor,
    kExpression: "Manual Type III",
    zeros: [fz1, fz2],
    poles: [fp1, fp2],
    components,
    messages,
  });
}

function addType3DesignMessages(input: CompensatorInputs, messages: Message[]): void {
  if (input.compensatorType !== "type3") {
    return;
  }
  if (input.resonantFrequency && input.crossoverFrequency < input.resonantFrequency * 3) {
    messages.push({
      severity: "warning",
      text: "Type III guide recommends f_C at least 3 to 5 times above the LC resonant frequency f_0.",
    });
  }
  if (input.switchingFrequency && input.crossoverFrequency > input.switchingFrequency / 5) {
    messages.push({
      severity: "warning",
      text: "Type III guide recommends keeping f_C around f_SW/10 to f_SW/5 and placing high-frequency poles near f_SW/2 for noise immunity.",
    });
  }
}

function assertManualInputs(input: CompensatorInputs, messages: Message[]): void {
  if (input.designMode !== "manual") {
    return;
  }
  if (input.compensatorType === "type1") {
    assertPositive(input.originPoleFrequency ?? Number.NaN, "f_p0", messages);
  }
  if (input.compensatorType === "type2") {
    assertPositive(input.zeroFrequency ?? Number.NaN, "f_z", messages);
    assertPositive(input.poleFrequency ?? Number.NaN, "f_p", messages);
    if (
      Number.isFinite(input.zeroFrequency) &&
      Number.isFinite(input.poleFrequency) &&
      (input.zeroFrequency ?? 0) >= (input.poleFrequency ?? 0)
    ) {
      messages.push({ severity: "danger", text: "Manual Type II requires f_z below f_p." });
    }
  }
  if (input.compensatorType === "type3") {
    assertPositive(input.zeroFrequency1 ?? Number.NaN, "f_z1", messages);
    assertPositive(input.zeroFrequency2 ?? Number.NaN, "f_z2", messages);
    assertPositive(input.poleFrequency1 ?? Number.NaN, "f_p1", messages);
    assertPositive(input.poleFrequency2 ?? Number.NaN, "f_p2", messages);
  }
}

function manualPhaseBoost(input: CompensatorInputs): number {
  if (input.compensatorType === "type1") {
    return 0;
  }
  if (input.compensatorType === "type2") {
    return phaseBoostAt(input.crossoverFrequency, [input.zeroFrequency ?? Number.NaN], [input.poleFrequency ?? Number.NaN]);
  }
  return phaseBoostAt(
    input.crossoverFrequency,
    [input.zeroFrequency1 ?? Number.NaN, input.zeroFrequency2 ?? Number.NaN],
    [input.poleFrequency1 ?? Number.NaN, input.poleFrequency2 ?? Number.NaN],
  );
}

function phaseBoostAt(frequency: number, zeros: number[], poles: number[]): number {
  return zeros.reduce((sum, zero) => sum + radiansToDegrees(Math.atan(frequency / zero)), 0) -
    poles.reduce((sum, pole) => sum + radiansToDegrees(Math.atan(frequency / pole)), 0);
}

function finishNetwork(input: {
  kFactor: number;
  kExpression: string;
  zeros: number[];
  poles: number[];
  components: CompensatorComponent[];
  messages: Message[];
}): {
  kFactor: number;
  kExpression: string;
  zeros: number[];
  poles: number[];
  components: CompensatorComponent[];
  messages: Message[];
} {
  input.components.forEach((item) => {
    const ratio = item.recommended / item.ideal;
    if (Number.isFinite(ratio) && (ratio > 1.35 || ratio < 0.74)) {
      input.messages.push({
        severity: "warning",
        text: `${item.label} standard value differs from the ideal value by more than 35%.`,
      });
    }
  });

  return input;
}

function componentFormula(type: CompensatorType): string {
  if (type === "type1") {
    return "f_p0 = G x f_C, C1 = 1 / (2pi x f_p0 x R1)";
  }
  if (type === "type2") {
    return "C1 = 1 / (2pi x f_C x G x R1), R2 = k / (2pi x f_C x C1), C2 = C1 / (k^2 - 1); exact fp = (C1 + C2) / (2pi x R2 x C1 x C2)";
  }
  return "C2 = 1 / (2pi x f_C x G x R1), C1 = C2 x (k - 1), R2 = sqrt(k) / (2pi x f_C x C1), R3 = R1 / (k - 1), C3 = 1 / (2pi x f_C x sqrt(k) x R3)";
}

function component(
  label: string,
  ideal: number,
  recommended: number,
  unit: "resistance" | "capacitance",
): CompensatorComponent {
  return { label, ideal, recommended, unit };
}

function recommendE24(value: number): number {
  return recommendFromSeries(value, E24);
}

function recommendE96(value: number): number {
  return recommendFromSeries(value, E96);
}

function recommendFromSeries(value: number, series: number[]): number {
  if (!Number.isFinite(value) || value <= 0) {
    return Number.NaN;
  }
  const decade = 10 ** Math.floor(Math.log10(value));
  for (const base of series) {
    const candidate = base * decade;
    if (candidate >= value) {
      return candidate;
    }
  }
  return 10 * decade;
}

function kFactorType2(boostDeg: number): number {
  return Math.tan(degreesToRadians(boostDeg / 2 + 45));
}

function kFactorType3(boostDeg: number): number {
  return Math.tan(degreesToRadians(boostDeg / 4 + 45)) ** 2;
}

function getMaxBoost(type: CompensatorType): number {
  if (type === "type3") {
    return 150;
  }
  if (type === "type2") {
    return 75;
  }
  return 0;
}

function labelType(type: CompensatorType): string {
  return type === "type1" ? "Type I" : type === "type2" ? "Type II" : "Type III";
}

function assertPositive(value: number, name: string, messages: Message[]): void {
  if (!Number.isFinite(value) || value <= 0) {
    messages.push({ severity: "danger", text: `${name} must be greater than zero.` });
  }
}

function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

function linearToDb(value: number): number {
  return 20 * Math.log10(value);
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function formatComponentIdeal(componentValue: CompensatorComponent): string {
  return componentValue.unit === "resistance"
    ? formatResistance(componentValue.ideal)
    : formatCapacitance(componentValue.ideal);
}

export function formatCompensatorComponent(componentValue: CompensatorComponent): string {
  return componentValue.unit === "resistance"
    ? formatResistance(componentValue.recommended)
    : formatCapacitance(componentValue.recommended);
}
