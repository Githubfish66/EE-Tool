import type { Message } from "./bootstrapCalculator";
import type { CompensatorBodePoint, CompensatorResult, LoopStabilityMetrics } from "./compensatorCalculator";
import { interpolateBode } from "./compensatorCalculator";
import { formatFrequency, formatGainDb, formatPhaseDeg } from "./units";

export type DigitalCompensatorMethod = "tustin";
export type PwmCarrierMode = "none" | "trailing-edge" | "leading-edge" | "symmetric";

export type DigitalCompensatorInputs = {
  analogResult: CompensatorResult;
  samplingFrequency: number;
  pwmFrequency?: number;
  pwmUpdateCycles?: number;
  dutyMin: number;
  dutyMax: number;
  initialDuty: number;
  outputDelaySamples: number;
  computationDelaySamples?: number;
  pwmCarrier?: PwmCarrierMode;
  adcBits: number;
  dpwmBits: number;
  method: DigitalCompensatorMethod;
};

export type DigitalIirCoefficient = {
  label: string;
  value: number;
};

export type DigitalAliasingDiagnostic = {
  modulationFrequency: number;
  lowerSidebandFrequency: number;
  aliasFrequency: number;
  directGainDb: number;
  sidebandGainDb: number;
  aliasToDirectRatioDb: number;
  severity: "ok" | "warning" | "danger";
};

export type DigitalCompensatorResult = {
  method: DigitalCompensatorMethod;
  samplingFrequency: number;
  samplingPeriod: number;
  order: number;
  numerator: number[];
  denominator: number[];
  bCoefficients: DigitalIirCoefficient[];
  aCoefficients: DigitalIirCoefficient[];
  digitalBode: CompensatorBodePoint[];
  digitalWithDelayBode: CompensatorBodePoint[];
  digitalLoopGainBode: CompensatorBodePoint[];
  digitalLoopGainWithDelayBode: CompensatorBodePoint[];
  digitalStabilityMargins: LoopStabilityMetrics;
  digitalDelayStabilityMargins: LoopStabilityMetrics;
  delayBudget: {
    totalDelaySeconds: number;
    totalDelaySamples: number;
    phaseAtCrossoverDeg: number;
    computationDelaySeconds: number;
    computationDelaySamples: number;
    outputDelaySeconds: number;
    outputDelaySamples: number;
    pwmDelaySeconds: number;
    pwmDelaySamples: number;
    updateAveragingDelaySeconds: number;
    updateAveragingDelaySamples: number;
    pwmMagnitudeAtCrossoverDb: number;
    components: Array<{
      label: string;
      seconds: number;
      samples: number;
    }>;
  };
  estimatedDelayPhaseDeg: number;
  pwmFrequency: number;
  pwmUpdateCycles: number;
  pwmCarrier: PwmCarrierMode;
  aliasingDiagnostics: {
    nyquistFrequency: number;
    updateFrequency: number;
    rows: DigitalAliasingDiagnostic[];
  };
  dutyMin: number;
  dutyMax: number;
  initialDuty: number;
  outputDelaySamples: number;
  adcBits: number;
  dpwmBits: number;
  parameterText: string;
  cCode: string;
  messages: Message[];
};

type Polynomial = number[];

export function calculateDigitalCompensator(input: DigitalCompensatorInputs): DigitalCompensatorResult {
  const messages: Message[] = [];
  assertPositive(input.samplingFrequency, "f_s", messages);
  const pwmFrequency = input.pwmFrequency ?? input.samplingFrequency;
  const pwmUpdateCycles = input.pwmUpdateCycles ?? 1;
  const pwmCarrier = input.pwmCarrier ?? "none";
  const computationDelaySamples = input.computationDelaySamples ?? 0;
  assertPositive(pwmFrequency, "f_PWM", messages);
  assertPositive(pwmUpdateCycles, "PWM_UPDATE_CYCLES", messages);
  assertPositive(input.adcBits, "ADC_BITS", messages);
  assertPositive(input.dpwmBits, "DPWM_BITS", messages);
  if (!Number.isFinite(input.dutyMin) || !Number.isFinite(input.dutyMax) || input.dutyMin >= input.dutyMax) {
    messages.push({ severity: "danger", text: "DUTY_MIN must be lower than DUTY_MAX." });
  }
  if (!Number.isFinite(input.initialDuty) || input.initialDuty < input.dutyMin || input.initialDuty > input.dutyMax) {
    messages.push({ severity: "warning", text: "INITIAL_DUTY should be inside the duty clamp range." });
  }
  if (!Number.isFinite(input.outputDelaySamples) || input.outputDelaySamples < 0) {
    messages.push({ severity: "danger", text: "OUTPUT_DELAY must be zero or greater." });
  }
  if (!Number.isFinite(computationDelaySamples) || computationDelaySamples < 0) {
    messages.push({ severity: "danger", text: "COMPUTE_DELAY must be zero or greater." });
  }

  const samplingPeriod = 1 / input.samplingFrequency;
  const { numerator, denominator } = bilinearTransform(input.analogResult, samplingPeriod);
  const order = denominator.length - 1;
  const digitalBode = buildDigitalBode(input.analogResult.compensatorBode, numerator, denominator, samplingPeriod);
  const outputDelaySeconds = input.outputDelaySamples * samplingPeriod;
  const computationDelaySeconds = computationDelaySamples * samplingPeriod;
  const pwmDelaySeconds = calculatePwmDelaySeconds(pwmCarrier, pwmFrequency, input.initialDuty);
  const updateAveragingDelaySeconds = calculateUpdateAveragingDelaySeconds(pwmUpdateCycles, pwmFrequency);
  const totalDelaySeconds = outputDelaySeconds + computationDelaySeconds + pwmDelaySeconds + updateAveragingDelaySeconds;
  const totalDelaySamples = totalDelaySeconds / samplingPeriod;
  const pwmMagnitudeAtCrossoverDb = calculatePwmMagnitudeDb(
    pwmCarrier,
    input.analogResult.crossoverFrequency,
    pwmFrequency,
  );
  const digitalWithDelayBode = applyPwmModulatorToBode(digitalBode, {
    carrier: pwmCarrier,
    totalDelaySeconds,
    pwmFrequency,
  });
  const digitalLoopGainBode = buildLoopGainBode(input.analogResult, digitalBode);
  const digitalLoopGainWithDelayBode = buildLoopGainBode(input.analogResult, digitalWithDelayBode);
  const digitalStabilityMargins = calculateStabilityMargins(digitalLoopGainBode);
  const digitalDelayStabilityMargins = calculateStabilityMargins(digitalLoopGainWithDelayBode);
  const aliasingDiagnostics = buildAliasingDiagnostics(input.analogResult, input.samplingFrequency, pwmFrequency, pwmUpdateCycles);
  const estimatedDelayPhaseDeg = -360 * input.analogResult.crossoverFrequency *
    totalDelaySeconds;
  const delayBudget = {
    totalDelaySeconds,
    totalDelaySamples,
    phaseAtCrossoverDeg: estimatedDelayPhaseDeg,
    computationDelaySeconds,
    computationDelaySamples,
    outputDelaySeconds,
    outputDelaySamples: input.outputDelaySamples,
    pwmDelaySeconds,
    pwmDelaySamples: pwmDelaySeconds / samplingPeriod,
    updateAveragingDelaySeconds,
    updateAveragingDelaySamples: updateAveragingDelaySeconds / samplingPeriod,
    pwmMagnitudeAtCrossoverDb,
    components: [
      { label: "Computation", seconds: computationDelaySeconds, samples: computationDelaySamples },
      { label: "Output register", seconds: outputDelaySeconds, samples: input.outputDelaySamples },
      { label: "PWM modulator", seconds: pwmDelaySeconds, samples: pwmDelaySeconds / samplingPeriod },
      { label: "N-cycle update hold", seconds: updateAveragingDelaySeconds, samples: updateAveragingDelaySeconds / samplingPeriod },
    ],
  };

  if (input.analogResult.crossoverFrequency > input.samplingFrequency / 10) {
    messages.push({
      severity: "warning",
      text: "Target crossover is above f_s/10. Sampling and computation delay may erode phase margin.",
    });
  }
  if (input.analogResult.crossoverFrequency > pwmFrequency / 10) {
    messages.push({
      severity: "warning",
      text: "Target crossover is above f_PWM/10. PWM modulator delay and carrier attenuation should be checked carefully.",
    });
  }
  if (pwmCarrier === "symmetric" && input.analogResult.crossoverFrequency > pwmFrequency / 5) {
    messages.push({
      severity: "warning",
      text: "Symmetric PWM magnitude attenuation becomes visible as crossover approaches the PWM carrier.",
    });
  }
  if (pwmUpdateCycles > 1 && input.samplingFrequency > pwmFrequency / pwmUpdateCycles * 1.05) {
    messages.push({
      severity: "warning",
      text: "f_s is higher than the requested PWM update cadence. If duty updates every N PWM cycles, set f_s close to f_PWM / PWM_UPDATE_CYCLES for coefficient generation.",
    });
  }
  const worstAliasing = aliasingDiagnostics.rows.find((row) => row.severity !== "ok");
  if (worstAliasing) {
    messages.push({
      severity: worstAliasing.severity === "danger" ? "danger" : "warning",
      text: `PWM sideband alias risk: f_PWM - f_m aliases to ${formatFrequency(worstAliasing.aliasFrequency)} with alias/direct ratio ${formatGainDb(worstAliasing.aliasToDirectRatioDb)}.`,
    });
  }
  if (
    digitalDelayStabilityMargins.phaseMarginDeg !== null &&
    Number.isFinite(digitalDelayStabilityMargins.phaseMarginDeg) &&
    digitalDelayStabilityMargins.phaseMarginDeg < 45
  ) {
    messages.push({
      severity: digitalDelayStabilityMargins.phaseMarginDeg < 30 ? "danger" : "warning",
      text: `Delay-aware digital loop phase margin is ${digitalDelayStabilityMargins.phaseMarginDeg.toFixed(1)} deg.`,
    });
  }
  if (order > 2) {
    messages.push({
      severity: "warning",
      text: "Full Tustin conversion is third order for this analog Type III compensator. Expose B3/A3 in SIMPLIS or split the controller into cascaded sections.",
    });
  }
  messages.push({
    severity: "info",
    text: `Tustin transform generated ${order} order IIR coefficients from the analog compensator poles and zeros.`,
  });

  const bCoefficients = numerator.map((value, index) => ({ label: `B${index}`, value }));
  const aCoefficients = denominator.slice(1).map((value, index) => ({ label: `A${index + 1}`, value }));
  const parameterText = formatParameterText({
    bCoefficients,
    aCoefficients,
    dutyMin: input.dutyMin,
    dutyMax: input.dutyMax,
    initialDuty: input.initialDuty,
    outputDelaySamples: input.outputDelaySamples,
    computationDelaySamples,
    samplingFrequency: input.samplingFrequency,
    pwmFrequency,
    pwmUpdateCycles,
    pwmCarrier,
  });
  const cCode = generateCCodeTemplate(order);

  return {
    method: input.method,
    samplingFrequency: input.samplingFrequency,
    samplingPeriod,
    order,
    numerator,
    denominator,
    bCoefficients,
    aCoefficients,
    digitalBode,
    digitalWithDelayBode,
    digitalLoopGainBode,
    digitalLoopGainWithDelayBode,
    digitalStabilityMargins,
    digitalDelayStabilityMargins,
    delayBudget,
    estimatedDelayPhaseDeg,
    pwmFrequency,
    pwmUpdateCycles,
    pwmCarrier,
    aliasingDiagnostics,
    dutyMin: input.dutyMin,
    dutyMax: input.dutyMax,
    initialDuty: input.initialDuty,
    outputDelaySamples: input.outputDelaySamples,
    adcBits: input.adcBits,
    dpwmBits: input.dpwmBits,
    parameterText,
    cCode,
    messages,
  };
}

function bilinearTransform(result: CompensatorResult, samplingPeriod: number): {
  numerator: number[];
  denominator: number[];
} {
  const c = 2 / samplingPeriod;
  const zeroTerms = result.zeros.map((zero) => firstOrderBilinearTerm(c / (2 * Math.PI * zero)));
  const poleTerms = result.poles.map((pole) => firstOrderBilinearTerm(c / (2 * Math.PI * pole)));
  const integratorTerm: Polynomial = [1, -1];
  const extraDelayFreeTerms = Math.max(result.poles.length + 1 - result.zeros.length, 0);
  const extraTerms = Array.from({ length: extraDelayFreeTerms }, () => [1, 1] as Polynomial);
  const shapeAtCrossover = analogShapeMagnitude(result.crossoverFrequency, result.zeros, result.poles);
  const scale = result.gainAtCrossover / Math.max(shapeAtCrossover, 1e-30);

  const numerator = [
    scale / c,
    ...zeroTerms,
    ...extraTerms,
  ].reduce<Polynomial>((product, item) => {
    if (typeof item === "number") {
      return product.map((value) => value * item);
    }
    return convolve(product, item);
  }, [1]);
  const denominator = [integratorTerm, ...poleTerms].reduce<Polynomial>(
    (product, item) => convolve(product, item),
    [1],
  );

  return normalizeIir(numerator, denominator);
}

function firstOrderBilinearTerm(ratio: number): Polynomial {
  return [1 + ratio, 1 - ratio];
}

function analogShapeMagnitude(frequency: number, zeros: number[], poles: number[]): number {
  const omega = 2 * Math.PI * frequency;
  const zeroProduct = zeros.reduce((product, zero) => product * Math.sqrt(1 + (frequency / zero) ** 2), 1);
  const poleProduct = poles.reduce((product, pole) => product * Math.sqrt(1 + (frequency / pole) ** 2), 1);
  return zeroProduct / Math.max(omega * poleProduct, 1e-30);
}

function normalizeIir(numerator: Polynomial, denominator: Polynomial): {
  numerator: number[];
  denominator: number[];
} {
  const leading = denominator[0];
  return {
    numerator: trimTiny(numerator.map((value) => value / leading)),
    denominator: trimTiny(denominator.map((value) => value / leading)),
  };
}

function trimTiny(values: number[]): number[] {
  return values.map((value) => Math.abs(value) < 1e-14 ? 0 : value);
}

function convolve(left: Polynomial, right: Polynomial): Polynomial {
  const result = Array.from({ length: left.length + right.length - 1 }, () => 0);
  left.forEach((leftValue, leftIndex) => {
    right.forEach((rightValue, rightIndex) => {
      result[leftIndex + rightIndex] += leftValue * rightValue;
    });
  });
  return result;
}

function buildDigitalBode(
  analogBode: CompensatorBodePoint[],
  numerator: number[],
  denominator: number[],
  samplingPeriod: number,
): CompensatorBodePoint[] {
  return analogBode
    .filter((point) => point.frequency < 0.49 / samplingPeriod)
    .map((point) => {
      const omega = 2 * Math.PI * point.frequency * samplingPeriod;
      const response = evaluateIir(numerator, denominator, omega);
      return {
        frequency: point.frequency,
        magnitudeDb: 20 * Math.log10(Math.max(complexMagnitude(response), 1e-30)),
        phaseDeg: radiansToDegrees(Math.atan2(response.im, response.re)),
      };
    });
}

function applyPwmModulatorToBode(
  points: CompensatorBodePoint[],
  model: {
    carrier: PwmCarrierMode;
    totalDelaySeconds: number;
    pwmFrequency: number;
  },
): CompensatorBodePoint[] {
  return points.map((point) => ({
    ...point,
    magnitudeDb: point.magnitudeDb + calculatePwmMagnitudeDb(model.carrier, point.frequency, model.pwmFrequency),
    phaseDeg: point.phaseDeg - 360 * point.frequency * model.totalDelaySeconds,
  }));
}

function calculatePwmDelaySeconds(carrier: PwmCarrierMode, pwmFrequency: number, duty: number): number {
  if (!Number.isFinite(pwmFrequency) || pwmFrequency <= 0) {
    return 0;
  }
  const pwmPeriod = 1 / pwmFrequency;
  const clampedDuty = Math.min(Math.max(duty, 0), 1);
  if (carrier === "trailing-edge") {
    return clampedDuty * pwmPeriod;
  }
  if (carrier === "leading-edge") {
    return (1 - clampedDuty) * pwmPeriod;
  }
  if (carrier === "symmetric") {
    return 0.5 * pwmPeriod;
  }
  return 0;
}

function calculateUpdateAveragingDelaySeconds(pwmUpdateCycles: number, pwmFrequency: number): number {
  if (!Number.isFinite(pwmUpdateCycles) || pwmUpdateCycles <= 1 || !Number.isFinite(pwmFrequency) || pwmFrequency <= 0) {
    return 0;
  }
  return ((pwmUpdateCycles - 1) / 2) / pwmFrequency;
}

function calculatePwmMagnitudeDb(carrier: PwmCarrierMode, frequency: number, pwmFrequency: number): number {
  if (carrier !== "symmetric" || !Number.isFinite(frequency) || !Number.isFinite(pwmFrequency) || pwmFrequency <= 0) {
    return 0;
  }
  const attenuation = Math.abs(Math.cos(Math.PI * frequency / pwmFrequency));
  return 20 * Math.log10(Math.max(attenuation, 1e-6));
}

function buildAliasingDiagnostics(
  analogResult: CompensatorResult,
  samplingFrequency: number,
  pwmFrequency: number,
  pwmUpdateCycles: number,
): DigitalCompensatorResult["aliasingDiagnostics"] {
  const nyquistFrequency = samplingFrequency / 2;
  const updateFrequency = pwmFrequency / Math.max(pwmUpdateCycles, 1);
  const candidateFrequencies = uniqueFrequencies([
    analogResult.crossoverFrequency / 2,
    analogResult.crossoverFrequency,
    analogResult.crossoverFrequency * 2,
  ]).filter((frequency) => frequency > 0 && frequency < nyquistFrequency * 0.95 && frequency < pwmFrequency);
  const rows = candidateFrequencies.map((modulationFrequency) => {
    const lowerSidebandFrequency = Math.abs(pwmFrequency - modulationFrequency);
    const aliasFrequency = foldFrequency(lowerSidebandFrequency, samplingFrequency);
    const directGainDb = interpolateCompensatorBode(analogResult.compensatorBode, modulationFrequency).magnitudeDb;
    const sidebandGainDb = interpolateCompensatorBode(analogResult.compensatorBode, lowerSidebandFrequency).magnitudeDb;
    const aliasToDirectRatioDb = sidebandGainDb - directGainDb;
    return {
      modulationFrequency,
      lowerSidebandFrequency,
      aliasFrequency,
      directGainDb,
      sidebandGainDb,
      aliasToDirectRatioDb,
      severity: classifyAliasRisk(aliasToDirectRatioDb),
    };
  });

  return {
    nyquistFrequency,
    updateFrequency,
    rows,
  };
}

function uniqueFrequencies(values: number[]): number[] {
  return values
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce<number[]>((items, value) => {
      if (items.some((item) => Math.abs(Math.log10(item) - Math.log10(value)) < 1e-6)) {
        return items;
      }
      return [...items, value];
    }, []);
}

function foldFrequency(frequency: number, samplingFrequency: number): number {
  if (!Number.isFinite(frequency) || !Number.isFinite(samplingFrequency) || samplingFrequency <= 0) {
    return Number.NaN;
  }
  const folded = ((frequency % samplingFrequency) + samplingFrequency) % samplingFrequency;
  return folded > samplingFrequency / 2 ? samplingFrequency - folded : folded;
}

function classifyAliasRisk(aliasToDirectRatioDb: number): DigitalAliasingDiagnostic["severity"] {
  if (!Number.isFinite(aliasToDirectRatioDb)) {
    return "warning";
  }
  if (aliasToDirectRatioDb > -10) {
    return "danger";
  }
  if (aliasToDirectRatioDb > -20) {
    return "warning";
  }
  return "ok";
}

function buildLoopGainBode(
  analogResult: CompensatorResult,
  controllerBode: CompensatorBodePoint[],
): CompensatorBodePoint[] {
  const plantPoints = analogResult.plantBode.map((item) => ({
    frequency: item.frequency,
    gainDb: item.magnitudeDb,
    phaseDeg: item.phaseDeg,
  }));
  return controllerBode.map((point) => {
    const plant = interpolateBode(plantPoints, point.frequency);
    return {
      frequency: point.frequency,
      magnitudeDb: point.magnitudeDb + plant.gainDb,
      phaseDeg: point.phaseDeg + plant.phaseDeg,
    };
  });
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

function evaluateIir(numerator: number[], denominator: number[], omega: number): { re: number; im: number } {
  const top = evaluatePolynomialOnUnitDelay(numerator, omega);
  const bottom = evaluatePolynomialOnUnitDelay(denominator, omega);
  const scale = bottom.re ** 2 + bottom.im ** 2;
  return {
    re: (top.re * bottom.re + top.im * bottom.im) / scale,
    im: (top.im * bottom.re - top.re * bottom.im) / scale,
  };
}

function evaluatePolynomialOnUnitDelay(values: number[], omega: number): { re: number; im: number } {
  return values.reduce(
    (sum, value, index) => ({
      re: sum.re + value * Math.cos(-omega * index),
      im: sum.im + value * Math.sin(-omega * index),
    }),
    { re: 0, im: 0 },
  );
}

function complexMagnitude(value: { re: number; im: number }): number {
  return Math.sqrt(value.re ** 2 + value.im ** 2);
}

function formatParameterText(input: {
  bCoefficients: DigitalIirCoefficient[];
  aCoefficients: DigitalIirCoefficient[];
  dutyMin: number;
  dutyMax: number;
  initialDuty: number;
  outputDelaySamples: number;
  computationDelaySamples: number;
  samplingFrequency: number;
  pwmFrequency: number;
  pwmUpdateCycles: number;
  pwmCarrier: PwmCarrierMode;
}): string {
  const lines = [
    `FS = ${formatCoefficient(input.samplingFrequency)}`,
    `PWM_FREQ = ${formatCoefficient(input.pwmFrequency)}`,
    `PWM_UPDATE_CYCLES = ${formatCoefficient(input.pwmUpdateCycles)}`,
    `PWM_CARRIER = ${input.pwmCarrier}`,
    ...input.bCoefficients.map((item) => `${item.label.toUpperCase()} = ${formatCoefficient(item.value)}`),
    ...input.aCoefficients.map((item) => `${item.label.toUpperCase()} = ${formatCoefficient(item.value)}`),
    `DUTY_MIN = ${formatCoefficient(input.dutyMin)}`,
    `DUTY_MAX = ${formatCoefficient(input.dutyMax)}`,
    `INITIAL_DUTY = ${formatCoefficient(input.initialDuty)}`,
    `COMPUTE_DELAY = ${formatCoefficient(input.computationDelaySamples)}`,
    `OUTPUT_DELAY = ${formatCoefficient(input.outputDelaySamples)}`,
  ];
  return lines.join("\n");
}

function generateCCodeTemplate(order: number): string {
  const historySize = order + 1;
  return `#define COMP_ORDER ${order}

typedef struct {
    double b[COMP_ORDER + 1];
    double a[COMP_ORDER + 1];
    double e[COMP_ORDER + 1];
    double u[COMP_ORDER + 1];
    double duty_min;
    double duty_max;
} DigitalComp;

static double clamp(double value, double min_value, double max_value) {
    if (value > max_value) return max_value;
    if (value < min_value) return min_value;
    return value;
}

double digital_comp_step(DigitalComp *comp, double vref, double vfb) {
    double e0 = vref - vfb;
    double u0 = comp->b[0] * e0;

    for (int i = 1; i <= COMP_ORDER; ++i) {
        u0 += comp->b[i] * comp->e[i];
        u0 -= comp->a[i] * comp->u[i];
    }

    u0 = clamp(u0, comp->duty_min, comp->duty_max);

    for (int i = COMP_ORDER; i > 1; --i) {
        comp->e[i] = comp->e[i - 1];
        comp->u[i] = comp->u[i - 1];
    }
    if (COMP_ORDER >= 1) {
        comp->e[1] = e0;
        comp->u[1] = u0;
    }

    return u0;
}

/* SIMPLIS action outline:
   1. On CLK rising edge, read VFB and VREF.
   2. Call digital_comp_step(&state, vref, vfb).
   3. Convert duty ratio to DPWM code.
   4. Write the DUTY output bus, applying OUTPUT_DELAY if needed.
   History length: ${historySize} samples.
 */`;
}

export function formatCoefficient(value: number): string {
  if (!Number.isFinite(value)) {
    return "NaN";
  }
  if (value === 0) {
    return "0";
  }
  return Math.abs(value) >= 1e4 || Math.abs(value) < 1e-3
    ? value.toExponential(10)
    : value.toPrecision(11);
}

export function formatDigitalSummary(result: DigitalCompensatorResult): string {
  return [
    `f_s = ${formatFrequency(result.samplingFrequency)}`,
    `T_s = ${formatCoefficient(result.samplingPeriod)} s`,
    `Order = ${result.order}`,
    `Delay phase at f_C = ${formatPhaseDeg(result.estimatedDelayPhaseDeg)}`,
    `PWM attenuation at f_C = ${formatGainDb(result.delayBudget.pwmMagnitudeAtCrossoverDb)}`,
    `Digital gain at f_C = ${formatGainDb(nearestPoint(result.digitalBode, result.samplingFrequency / 100)?.magnitudeDb ?? Number.NaN)}`,
  ].join("\n");
}

function nearestPoint(points: CompensatorBodePoint[], frequency: number): CompensatorBodePoint | null {
  if (points.length === 0) {
    return null;
  }
  return points.reduce((best, point) =>
    Math.abs(Math.log10(point.frequency) - Math.log10(frequency)) <
      Math.abs(Math.log10(best.frequency) - Math.log10(frequency))
      ? point
      : best,
  );
}

function assertPositive(value: number, name: string, messages: Message[]): void {
  if (!Number.isFinite(value) || value <= 0) {
    messages.push({ severity: "danger", text: `${name} must be greater than zero.` });
  }
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
