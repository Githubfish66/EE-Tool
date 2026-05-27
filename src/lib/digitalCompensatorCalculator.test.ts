import { describe, expect, it } from "vitest";
import { calculateCompensator, parseBodeCsv } from "./compensatorCalculator";
import { calculateDigitalCompensator } from "./digitalCompensatorCalculator";

const csv = `freq,gain,phase
100,-2,-70
1000,-20,-105
10000,-40,-145
100000,-60,-175`;

describe("digital compensator Tustin conversion", () => {
  it("converts Type I into an incremental digital integrator", () => {
    const analog = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type1",
      designMode: "auto",
      crossoverFrequency: 1000,
      r1: 10_000,
    });

    const digital = calculateDigitalCompensator({
      analogResult: analog,
      samplingFrequency: 100_000,
      dutyMin: 0.02,
      dutyMax: 0.95,
      initialDuty: 0.1,
      outputDelaySamples: 1,
      adcBits: 12,
      dpwmBits: 10,
      method: "tustin",
    });

    expect(digital.order).toBe(1);
    expect(digital.numerator[0]).toBeCloseTo(0.314159, 5);
    expect(digital.numerator[1]).toBeCloseTo(0.314159, 5);
    expect(digital.denominator).toEqual([1, -1]);
    expect(digital.parameterText).toContain("B0");
    expect(digital.cCode).toContain("#define COMP_ORDER 1");
  });

  it("keeps Type II as a second-order IIR after Tustin conversion", () => {
    const analog = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type2",
      designMode: "auto",
      crossoverFrequency: 1000,
      targetPhaseMargin: 50,
      r1: 10_000,
    });

    const digital = calculateDigitalCompensator({
      analogResult: analog,
      samplingFrequency: 100_000,
      dutyMin: 0.02,
      dutyMax: 0.95,
      initialDuty: 0.1,
      outputDelaySamples: 1,
      adcBits: 12,
      dpwmBits: 10,
      method: "tustin",
    });

    expect(digital.order).toBe(2);
    expect(digital.bCoefficients).toHaveLength(3);
    expect(digital.aCoefficients).toHaveLength(2);
    expect(digital.digitalBode.length).toBeGreaterThan(20);
    expect(digital.digitalWithDelayBode).toHaveLength(digital.digitalBode.length);
    expect(digital.digitalLoopGainWithDelayBode).toHaveLength(digital.digitalLoopGainBode.length);
    expect(digital.messages.some((message) => message.severity === "danger")).toBe(false);
  });

  it("applies output delay as additional phase lag and recomputes margins", () => {
    const analog = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type2",
      designMode: "auto",
      crossoverFrequency: 1000,
      targetPhaseMargin: 50,
      r1: 10_000,
    });

    const digital = calculateDigitalCompensator({
      analogResult: analog,
      samplingFrequency: 100_000,
      dutyMin: 0.02,
      dutyMax: 0.95,
      initialDuty: 0.1,
      outputDelaySamples: 2,
      adcBits: 12,
      dpwmBits: 10,
      method: "tustin",
    });

    const noDelay = nearestBodePoint(digital.digitalBode, 1000);
    const withDelay = nearestBodePoint(digital.digitalWithDelayBode, 1000);

    expect(digital.delayBudget.totalDelaySeconds).toBeCloseTo(20e-6, 12);
    expect(digital.delayBudget.phaseAtCrossoverDeg).toBeCloseTo(-7.2, 8);
    expect(withDelay.phaseDeg - noDelay.phaseDeg).toBeCloseTo(-7.2, 1);
    expect(digital.digitalDelayStabilityMargins.phaseMarginDeg ?? 0).toBeLessThan(
      digital.digitalStabilityMargins.phaseMarginDeg ?? Number.POSITIVE_INFINITY,
    );
  });

  it("adds duty-dependent PWM carrier delay to the delay budget", () => {
    const analog = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type2",
      designMode: "auto",
      crossoverFrequency: 1000,
      targetPhaseMargin: 50,
      r1: 10_000,
    });

    const digital = calculateDigitalCompensator({
      analogResult: analog,
      samplingFrequency: 100_000,
      pwmFrequency: 100_000,
      dutyMin: 0.02,
      dutyMax: 0.95,
      initialDuty: 0.25,
      outputDelaySamples: 1,
      computationDelaySamples: 0.5,
      pwmCarrier: "trailing-edge",
      adcBits: 12,
      dpwmBits: 10,
      method: "tustin",
    });

    expect(digital.delayBudget.outputDelaySeconds).toBeCloseTo(10e-6, 12);
    expect(digital.delayBudget.computationDelaySeconds).toBeCloseTo(5e-6, 12);
    expect(digital.delayBudget.pwmDelaySeconds).toBeCloseTo(2.5e-6, 12);
    expect(digital.delayBudget.totalDelaySeconds).toBeCloseTo(17.5e-6, 12);
    expect(digital.delayBudget.phaseAtCrossoverDeg).toBeCloseTo(-6.3, 8);
  });

  it("applies symmetric PWM carrier attenuation", () => {
    const analog = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type2",
      designMode: "auto",
      crossoverFrequency: 10_000,
      targetPhaseMargin: 50,
      r1: 10_000,
    });

    const digital = calculateDigitalCompensator({
      analogResult: analog,
      samplingFrequency: 100_000,
      pwmFrequency: 100_000,
      dutyMin: 0.02,
      dutyMax: 0.95,
      initialDuty: 0.5,
      outputDelaySamples: 0,
      computationDelaySamples: 0,
      pwmCarrier: "symmetric",
      adcBits: 12,
      dpwmBits: 10,
      method: "tustin",
    });

    const noDelay = nearestBodePoint(digital.digitalBode, 10_000);
    const withPwm = nearestBodePoint(digital.digitalWithDelayBode, 10_000);
    const expectedAttenuationDb = 20 * Math.log10(Math.cos(Math.PI * 10_000 / 100_000));

    expect(digital.delayBudget.pwmDelaySeconds).toBeCloseTo(5e-6, 12);
    expect(digital.delayBudget.pwmMagnitudeAtCrossoverDb).toBeCloseTo(expectedAttenuationDb, 8);
    expect(withPwm.magnitudeDb - noDelay.magnitudeDb).toBeCloseTo(expectedAttenuationDb, 1);
  });

  it("adds low-frequency hold delay when duty updates every N PWM cycles", () => {
    const analog = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type2",
      designMode: "auto",
      crossoverFrequency: 1000,
      targetPhaseMargin: 50,
      r1: 10_000,
    });

    const digital = calculateDigitalCompensator({
      analogResult: analog,
      samplingFrequency: 25_000,
      pwmFrequency: 100_000,
      pwmUpdateCycles: 4,
      dutyMin: 0.02,
      dutyMax: 0.95,
      initialDuty: 0.25,
      outputDelaySamples: 0,
      computationDelaySamples: 0,
      pwmCarrier: "none",
      adcBits: 12,
      dpwmBits: 10,
      method: "tustin",
    });

    expect(digital.delayBudget.updateAveragingDelaySeconds).toBeCloseTo(15e-6, 12);
    expect(digital.delayBudget.totalDelaySeconds).toBeCloseTo(15e-6, 12);
    expect(digital.delayBudget.phaseAtCrossoverDeg).toBeCloseTo(-5.4, 8);
    expect(digital.parameterText).toContain("PWM_UPDATE_CYCLES = 4");
  });

  it("reports PWM lower-sideband aliasing diagnostics", () => {
    const analog = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type2",
      designMode: "auto",
      crossoverFrequency: 1000,
      targetPhaseMargin: 50,
      r1: 10_000,
    });

    const digital = calculateDigitalCompensator({
      analogResult: analog,
      samplingFrequency: 100_000,
      pwmFrequency: 100_000,
      dutyMin: 0.02,
      dutyMax: 0.95,
      initialDuty: 0.25,
      outputDelaySamples: 0,
      computationDelaySamples: 0,
      pwmCarrier: "none",
      adcBits: 12,
      dpwmBits: 10,
      method: "tustin",
    });

    const crossoverRow = digital.aliasingDiagnostics.rows.find((row) => row.modulationFrequency === 1000);

    expect(digital.aliasingDiagnostics.nyquistFrequency).toBeCloseTo(50_000, 8);
    expect(crossoverRow?.lowerSidebandFrequency).toBeCloseTo(99_000, 8);
    expect(crossoverRow?.aliasFrequency).toBeCloseTo(1000, 8);
    expect(crossoverRow?.aliasToDirectRatioDb).toBeLessThan(0);
  });

  it("warns that full Type III Tustin conversion needs third-order coefficients", () => {
    const analog = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type3",
      designMode: "auto",
      crossoverFrequency: 10_000,
      targetPhaseMargin: 60,
      r1: 20_000,
      resonantFrequency: 2000,
      switchingFrequency: 100_000,
    });

    const digital = calculateDigitalCompensator({
      analogResult: analog,
      samplingFrequency: 250_000,
      dutyMin: 0.02,
      dutyMax: 0.95,
      initialDuty: 0.1,
      outputDelaySamples: 1,
      adcBits: 12,
      dpwmBits: 10,
      method: "tustin",
    });

    expect(digital.order).toBe(3);
    expect(digital.bCoefficients).toHaveLength(4);
    expect(digital.aCoefficients).toHaveLength(3);
    expect(digital.messages.some((message) => message.text.includes("third order"))).toBe(true);
    expect(digital.cCode).toContain("#define COMP_ORDER 3");
  });
});

function nearestBodePoint(
  points: Array<{ frequency: number; magnitudeDb: number; phaseDeg: number }>,
  frequency: number,
) {
  return points.reduce((best, point) =>
    Math.abs(Math.log10(point.frequency) - Math.log10(frequency)) <
      Math.abs(Math.log10(best.frequency) - Math.log10(frequency))
      ? point
      : best,
  );
}
