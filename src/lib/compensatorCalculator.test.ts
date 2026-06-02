import { describe, expect, it } from "vitest";
import {
  calculateCompensator,
  interpolateBode,
  parseBodeCsv,
} from "./compensatorCalculator";

const csv = `freq,gain,phase
100,-2,-70
1000,-20,-105
10000,-40,-145
100000,-60,-175`;

describe("non-isolated op amp k-factor compensator calculations", () => {
  it("parses fixed freq,gain,phase CSV columns", () => {
    const result = parseBodeCsv(csv);

    expect(result.messages.some((message) => message.severity === "danger")).toBe(false);
    expect(result.points).toHaveLength(4);
    expect(result.points[1]).toEqual({ frequency: 1000, gainDb: -20, phaseDeg: -105 });
  });

  it("rejects missing columns and invalid rows", () => {
    const missing = parseBodeCsv("frequency,gain\n100,1");
    const invalid = parseBodeCsv("freq,gain,phase\n0,1,-90\n100,x,-100");

    expect(missing.messages.some((message) => message.text.includes("freq,gain,phase"))).toBe(true);
    expect(invalid.messages.filter((message) => message.severity === "danger").length).toBeGreaterThan(0);
  });

  it("interpolates gain and phase on a logarithmic frequency axis", () => {
    const parsed = parseBodeCsv(csv);
    const point = interpolateBode(parsed.points, Math.sqrt(1000 * 10000));

    expect(point.gainDb).toBeCloseTo(-30, 6);
    expect(point.phaseDeg).toBeCloseTo(-125, 6);
  });

  it("calculates Type I from Bode-derived G and warns when boost is required", () => {
    const result = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type1",
      designMode: "auto",
      crossoverFrequency: 1000,
      r1: 10_000,
    });

    expect(result.gainAtCrossover).toBeCloseTo(10, 12);
    expect(result.targetPhaseMargin).toBeNull();
    expect(result.estimatedPhaseMargin).toBeCloseTo(-15, 12);
    expect(result.originPoleFrequency).toBeCloseTo(10_000, 12);
    expect(result.requiredPhaseBoostDeg).toBe(0);
    expect(result.kFactor).toBe(1);
    expect(result.zeros).toHaveLength(0);
    expect(result.poles).toHaveLength(0);
    expect(result.components.find((item) => item.label === "C1")?.ideal).toBeCloseTo(1.59155e-9, 13);
    expect(result.messages.some((message) => message.text.includes("no phase boost"))).toBe(true);
    expect(result.simetrixLaplaceExpression).toBe("62831.8530718/s");
    const crossoverPoint = nearestBodePoint(result.compensatorBode, 1000);
    expect(crossoverPoint.magnitudeDb).toBeCloseTo(20, 0);
    expect(crossoverPoint.phaseDeg).toBeCloseTo(-90, 6);
    expect(nearestBodePoint(result.loopGainBode, 1000).magnitudeDb).toBeCloseTo(0, 0);
  });

  it("calculates Type II with Appendix 5B k-factor component definitions", () => {
    const result = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type2",
      designMode: "auto",
      crossoverFrequency: 1000,
      targetPhaseMargin: 50,
      r1: 10_000,
    });

    const boost = 50 - 90 - (-105);
    const k = Math.tan(((boost / 2 + 45) * Math.PI) / 180);
    const g = 10;
    const c1 = 1 / (2 * Math.PI * 1000 * g * 10_000);
    const r2 = k / (2 * Math.PI * 1000 * c1);
    const c2 = c1 / (k ** 2 - 1);

    expect(result.requiredPhaseBoostDeg).toBeCloseTo(boost, 12);
    expect(result.kFactor).toBeCloseTo(k, 12);
    expect(result.zeros[0]).toBeCloseTo(1000 / k, 8);
    expect(result.poles[0]).toBeCloseTo(1000 * k, 8);
    expect(result.components.find((item) => item.label === "C2")?.ideal).toBeCloseTo(c2, 13);
    expect(result.components.find((item) => item.label === "C1")?.ideal).toBeCloseTo(c1, 13);
    expect(result.components.find((item) => item.label === "R2")?.ideal).toBeCloseTo(r2, 8);
    expect(1 / (2 * Math.PI * r2 * c1)).toBeCloseTo(result.zeros[0], 8);
    expect((c1 + c2) / (2 * Math.PI * r2 * c1 * c2)).toBeCloseTo(result.poles[0], 8);
    expect(result.simetrixLaplaceExpression).toBe(
      [
        formatSimetrixNumber((g * 2 * Math.PI * 1000) / k),
        `*(1+s/${formatSimetrixNumber((2 * Math.PI * 1000) / k)})`,
        `/(s*(1+s/${formatSimetrixNumber(2 * Math.PI * 1000 * k)}))`,
      ].join(""),
    );
    const crossoverPoint = nearestBodePoint(result.compensatorBode, 1000);
    expect(crossoverPoint.magnitudeDb).toBeCloseTo(20, 0);
    expect(crossoverPoint.phaseDeg).toBeCloseTo(-90 + boost, 0);
    expect(result.stabilityMargins.gainCrossoverFrequency).toBeCloseTo(1000, 0);
    expect(result.stabilityMargins.phaseMarginDeg).toBeCloseTo(50, 0);
  });

  it("calculates Type III with Appendix 5B k-factor component definitions", () => {
    const result = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type3",
      designMode: "auto",
      crossoverFrequency: 10_000,
      targetPhaseMargin: 60,
      r1: 20_000,
      resonantFrequency: 2000,
      switchingFrequency: 100_000,
    });

    const boost = 60 - 90 - (-145);
    const k = Math.tan(((boost / 4 + 45) * Math.PI) / 180) ** 2;
    const sqrtK = Math.sqrt(k);
    const g = 100;
    const c2 = 1 / (2 * Math.PI * 10_000 * 20_000 * g);
    const c1 = c2 * (k - 1);
    const r2 = sqrtK / (2 * Math.PI * 10_000 * c1);
    const r3 = 20_000 / (k - 1);
    const c3 = 1 / (2 * Math.PI * 10_000 * sqrtK * r3);

    expect(result.kFactor).toBeCloseTo(k, 12);
    expect(result.zeros).toHaveLength(2);
    expect(result.poles).toHaveLength(2);
    expect(result.components.find((item) => item.label === "C2")?.ideal).toBeCloseTo(c2, 13);
    expect(result.components.find((item) => item.label === "C1")?.ideal).toBeCloseTo(c1, 13);
    expect(result.components.find((item) => item.label === "R2")?.ideal).toBeCloseTo(r2, 8);
    expect(result.components.find((item) => item.label === "R3")?.ideal).toBeCloseTo(r3, 8);
    expect(result.components.find((item) => item.label === "C3")?.ideal).toBeCloseTo(c3, 13);
    expect(1 / (2 * Math.PI * r2 * c1)).toBeCloseTo(result.zeros[0], 8);
    expect((c1 + c2) / (2 * Math.PI * r2 * c1 * c2)).toBeCloseTo(result.poles[0], 8);
    expect(1 / (2 * Math.PI * (20_000 + r3) * c3)).toBeCloseTo(result.zeros[1], 8);
    expect(1 / (2 * Math.PI * r3 * c3)).toBeCloseTo(result.poles[1], 8);
    expect(result.simetrixLaplaceExpression).toBe(
      [
        formatSimetrixNumber((g * 2 * Math.PI * 10_000) / k),
        `*(1+s/${formatSimetrixNumber((2 * Math.PI * 10_000) / sqrtK)})`,
        `*(1+s/${formatSimetrixNumber((2 * Math.PI * 10_000) / sqrtK)})`,
        `/(s*(1+s/${formatSimetrixNumber(2 * Math.PI * 10_000 * sqrtK)})`,
        `*(1+s/${formatSimetrixNumber(2 * Math.PI * 10_000 * sqrtK)}))`,
      ].join(""),
    );
    const crossoverPoint = nearestBodePoint(result.compensatorBode, 10_000);
    expect(crossoverPoint.magnitudeDb).toBeCloseTo(40, 0);
    expect(crossoverPoint.phaseDeg).toBeCloseTo(-90 + boost, 0);
  });

  it("flags target crossover outside imported data", () => {
    const result = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type2",
      designMode: "auto",
      crossoverFrequency: 1_000_000,
      targetPhaseMargin: 60,
      r1: 10_000,
    });

    expect(result.messages.some((message) => message.text.includes("outside"))).toBe(true);
  });

  it("calculates manual Type I from an entered origin pole frequency", () => {
    const result = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type1",
      designMode: "manual",
      crossoverFrequency: 1000,
      originPoleFrequency: 5000,
      r1: 10_000,
    });

    expect(result.designMode).toBe("manual");
    expect(result.originPoleFrequency).toBe(5000);
    expect(result.components.find((item) => item.label === "C1")?.ideal).toBeCloseTo(
      1 / (2 * Math.PI * 5000 * 10_000),
      13,
    );
  });

  it("calculates manual Type II from entered zero and pole frequencies", () => {
    const result = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type2",
      designMode: "manual",
      crossoverFrequency: 1000,
      zeroFrequency: 300,
      poleFrequency: 3000,
      r1: 10_000,
    });

    const c1 = 1 / (2 * Math.PI * 1000 * 10 * 10_000);
    const r2 = 1 / (2 * Math.PI * 300 * c1);
    const c2 = c1 * 300 / (3000 - 300);
    expect(result.zeros[0]).toBe(300);
    expect(result.poles[0]).toBe(3000);
    expect(result.components.find((item) => item.label === "C1")?.ideal).toBeCloseTo(c1, 13);
    expect(result.components.find((item) => item.label === "R2")?.ideal).toBeCloseTo(r2, 8);
    expect(result.components.find((item) => item.label === "C2")?.ideal).toBeCloseTo(c2, 13);
    expect((c1 + c2) / (2 * Math.PI * r2 * c1 * c2)).toBeCloseTo(3000, 8);
  });

  it("calculates manual Type III from split zero and pole frequencies", () => {
    const result = calculateCompensator({
      bodePoints: parseBodeCsv(csv).points,
      compensatorType: "type3",
      designMode: "manual",
      crossoverFrequency: 10_000,
      zeroFrequency1: 2000,
      zeroFrequency2: 8000,
      poleFrequency1: 50_000,
      poleFrequency2: 50_000,
      r1: 20_000,
    });

    expect(result.zeros).toEqual([2000, 8000]);
    expect(result.poles).toEqual([50_000, 50_000]);
    expect(result.simetrixLaplaceExpression).toContain("(1+s/12566.3706144)");
    expect(result.simetrixLaplaceExpression).toContain("(1+s/50265.4824574)");
    expect(result.simetrixLaplaceExpression).toContain("(1+s/314159.265359)");
    expect(result.components.some((item) => item.label === "R3")).toBe(true);
    expect(result.components.some((item) => item.label === "C3")).toBe(true);
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

function formatSimetrixNumber(value: number): string {
  return Number(value.toPrecision(12)).toString();
}
