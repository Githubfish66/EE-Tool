import { describe, expect, it } from "vitest";
import { calculateInfineon, calculateOnsemi, calculateTi } from "./bootstrapCalculator";
import { kHz, mA, nC, nF, uA, uF, us } from "./units";

describe("bootstrap capacitor calculations", () => {
  it("calculates TI integrated rule-of-thumb and detailed minimum", () => {
    const result = calculateTi({
      vdd: 12,
      diodeDrop: 0.7,
      vhbl: 8,
      qg: nC(50),
      ihbs: uA(100),
      ihb: uA(20),
      dmax: 0.8,
      fsw: kHz(100),
      selectedCboot: nF(100),
      cvdd: uF(2.2),
    });

    expect(result.minimumCboot).toBeCloseTo(44.247e-9, 11);
    expect(result.recommendedCboot).toBeGreaterThanOrEqual(result.minimumCboot);
    expect(result.procurement.searchQuery).toContain("ceramic capacitor");
    expect(result.procurement.voltageRating).toBe("25V");
    expect(result.messages.some((message) => message.severity === "danger")).toBe(false);
  });

  it("warns when TI voltage headroom is invalid", () => {
    const result = calculateTi({
      vdd: 5,
      diodeDrop: 0.7,
      vhbl: 4.5,
      qg: nC(20),
      ihbs: uA(10),
      ihb: uA(10),
      dmax: 0.5,
      fsw: kHz(100),
    });

    expect(result.messages.some((message) => message.severity === "danger")).toBe(true);
  });

  it("calculates onsemi charge budget with leakage and level-shift charge", () => {
    const result = calculateOnsemi({
      vdd: 12,
      diodeDrop: 0.7,
      vgsMin: 8,
      qGate: nC(50),
      ilkCap: uA(1),
      ilkGs: uA(1),
      iqbs: uA(150),
      ilk: uA(2),
      ilkDiode: uA(1),
      tOn: us(10),
      qls: nC(5),
      selectedCboot: nF(100),
      cvdd: uF(2.2),
    });

    expect(result.minimumCboot).toBeCloseTo(17.136e-9, 11);
    expect(result.selectedMargin).toBeGreaterThan(5);
  });

  it("calculates Infineon ripple and Rboot drop", () => {
    const result = calculateInfineon({
      qgStar: nC(50),
      leakage: uA(100),
      fsw: kHz(100),
      duty: 0.5,
      rboot: 2,
      cboot: nF(100),
      allowedVdrop: 0.5,
      cvdd: uF(2.2),
    });

    expect(result.minimumCboot).toBeCloseTo(52.648e-9, 11);
    expect(result.messages.some((message) => message.severity === "danger")).toBe(false);
  });

  it("flags invalid Infineon duty cycle", () => {
    const result = calculateInfineon({
      qgStar: nC(20),
      leakage: uA(10),
      fsw: kHz(100),
      duty: 1,
      rboot: 2,
      cboot: nF(100),
      allowedVdrop: 0.5,
    });

    expect(result.messages.some((message) => message.text.includes("Duty"))).toBe(true);
  });

  it("warns when selected capacitor is too small", () => {
    const result = calculateOnsemi({
      vdd: 12,
      diodeDrop: 0.7,
      vgsMin: 8,
      qGate: nC(50),
      ilkCap: 0,
      ilkGs: 0,
      iqbs: 0,
      ilk: 0,
      ilkDiode: 0,
      tOn: us(1),
      qls: 0,
      selectedCboot: nF(1),
    });

    expect(result.messages.some((message) => message.text.includes("below"))).toBe(true);
  });
});
