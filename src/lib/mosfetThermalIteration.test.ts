import { describe, expect, it } from "vitest";
import { calculateMosfetThermalIteration } from "./mosfetThermalIteration";

describe("calculateMosfetThermalIteration", () => {
  it("estimates junction temperature and suggests a relaxed next simulation temperature", () => {
    const result = calculateMosfetThermalIteration({
      ambientTemperatureC: 50,
      simulationTemperatureC: 50,
      powerLossW: 3.2,
      rthJunctionCase: 0.8,
      rthCaseAmbient: 12,
      maxJunctionTemperatureC: 150,
      relaxationFactor: 0.6,
      toleranceC: 1,
    });

    expect(result.rthTotal).toBeCloseTo(12.8);
    expect(result.estimatedJunctionTemperatureC).toBeCloseTo(90.96);
    expect(result.errorC).toBeCloseTo(40.96);
    expect(result.marginC).toBeCloseTo(59.04);
    expect(result.nextSimulationTemperatureC).toBeCloseTo(74.576);
    expect(result.status).toBe("iterate");
  });

  it("marks a result as converged when the thermal estimate is inside tolerance", () => {
    const result = calculateMosfetThermalIteration({
      ambientTemperatureC: 50,
      simulationTemperatureC: 99,
      powerLossW: 3.83,
      rthJunctionCase: 0.8,
      rthCaseAmbient: 12,
      maxJunctionTemperatureC: 150,
      relaxationFactor: 0.6,
      toleranceC: 1,
    });

    expect(result.estimatedJunctionTemperatureC).toBeCloseTo(99.024);
    expect(result.absErrorC).toBeLessThanOrEqual(1);
    expect(result.status).toBe("converged");
  });

  it("prioritizes over-limit status when estimated Tj exceeds the maximum", () => {
    const result = calculateMosfetThermalIteration({
      ambientTemperatureC: 85,
      simulationTemperatureC: 120,
      powerLossW: 6,
      rthJunctionCase: 1,
      rthCaseAmbient: 12,
      maxJunctionTemperatureC: 150,
      relaxationFactor: 0.6,
      toleranceC: 1,
    });

    expect(result.marginC).toBeLessThan(0);
    expect(result.status).toBe("over-limit");
  });

  it("reports invalid input instead of producing misleading numbers", () => {
    const result = calculateMosfetThermalIteration({
      ambientTemperatureC: 50,
      simulationTemperatureC: 50,
      powerLossW: -1,
      rthJunctionCase: 0.8,
      rthCaseAmbient: 12,
      maxJunctionTemperatureC: 150,
      relaxationFactor: 0,
      toleranceC: 1,
    });

    expect(result.status).toBe("invalid");
    expect(result.messages).toHaveLength(2);
  });
});
