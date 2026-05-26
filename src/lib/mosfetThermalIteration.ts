export type MosfetThermalInputs = {
  ambientTemperatureC: number;
  simulationTemperatureC: number;
  powerLossW: number;
  rthJunctionCase: number;
  rthCaseAmbient: number;
  maxJunctionTemperatureC: number;
  relaxationFactor: number;
  toleranceC: number;
};

export type MosfetThermalStatus = "converged" | "near" | "iterate" | "over-limit" | "invalid";

export type MosfetThermalResult = {
  rthTotal: number;
  estimatedJunctionTemperatureC: number;
  errorC: number;
  absErrorC: number;
  marginC: number;
  nextSimulationTemperatureC: number;
  status: MosfetThermalStatus;
  messages: string[];
};

export function calculateMosfetThermalIteration(inputs: MosfetThermalInputs): MosfetThermalResult {
  const messages = validateMosfetThermalInputs(inputs);
  if (messages.length > 0) {
    return {
      rthTotal: Number.NaN,
      estimatedJunctionTemperatureC: Number.NaN,
      errorC: Number.NaN,
      absErrorC: Number.NaN,
      marginC: Number.NaN,
      nextSimulationTemperatureC: Number.NaN,
      status: "invalid",
      messages,
    };
  }

  const rthTotal = inputs.rthJunctionCase + inputs.rthCaseAmbient;
  const estimatedJunctionTemperatureC = inputs.ambientTemperatureC + inputs.powerLossW * rthTotal;
  const errorC = estimatedJunctionTemperatureC - inputs.simulationTemperatureC;
  const absErrorC = Math.abs(errorC);
  const marginC = inputs.maxJunctionTemperatureC - estimatedJunctionTemperatureC;
  const nextSimulationTemperatureC =
    inputs.simulationTemperatureC + inputs.relaxationFactor * errorC;
  const status = classifyMosfetThermalStatus(absErrorC, marginC, inputs.toleranceC);

  return {
    rthTotal,
    estimatedJunctionTemperatureC,
    errorC,
    absErrorC,
    marginC,
    nextSimulationTemperatureC,
    status,
    messages: buildMosfetThermalMessages(status, errorC, marginC),
  };
}

function validateMosfetThermalInputs(inputs: MosfetThermalInputs): string[] {
  const messages: string[] = [];
  if (!Number.isFinite(inputs.ambientTemperatureC)) {
    messages.push("Ambient temperature must be a finite number.");
  }
  if (!Number.isFinite(inputs.simulationTemperatureC)) {
    messages.push("Simulation temperature must be a finite number.");
  }
  if (!Number.isFinite(inputs.powerLossW) || inputs.powerLossW < 0) {
    messages.push("Power loss must be zero or positive.");
  }
  if (!Number.isFinite(inputs.rthJunctionCase) || inputs.rthJunctionCase < 0) {
    messages.push("Rth(j-c) must be zero or positive.");
  }
  if (!Number.isFinite(inputs.rthCaseAmbient) || inputs.rthCaseAmbient < 0) {
    messages.push("Rth(c-a) must be zero or positive.");
  }
  if (!Number.isFinite(inputs.maxJunctionTemperatureC)) {
    messages.push("Maximum junction temperature must be a finite number.");
  }
  if (
    !Number.isFinite(inputs.relaxationFactor) ||
    inputs.relaxationFactor <= 0 ||
    inputs.relaxationFactor > 1
  ) {
    messages.push("Relaxation factor must be greater than 0 and no more than 1.");
  }
  if (!Number.isFinite(inputs.toleranceC) || inputs.toleranceC <= 0) {
    messages.push("Convergence tolerance must be greater than 0.");
  }
  return messages;
}

function classifyMosfetThermalStatus(
  absErrorC: number,
  marginC: number,
  toleranceC: number,
): MosfetThermalStatus {
  if (marginC < 0) {
    return "over-limit";
  }
  if (absErrorC <= toleranceC) {
    return "converged";
  }
  if (absErrorC <= toleranceC * 5) {
    return "near";
  }
  return "iterate";
}

function buildMosfetThermalMessages(
  status: MosfetThermalStatus,
  errorC: number,
  marginC: number,
): string[] {
  if (status === "over-limit") {
    return ["Estimated Tj exceeds the maximum junction temperature. Improve cooling or reduce loss before accepting this operating point."];
  }
  if (status === "converged") {
    return ["The L1 fixed-temperature iteration is converged for this steady-state thermal model."];
  }
  if (status === "near") {
    return ["The estimate is close. Run one more L1 simulation at the suggested temperature to confirm."];
  }
  const direction = errorC > 0 ? "higher" : "lower";
  return [`Run the next L1 simulation at a ${direction} temperature and enter the new measured loss.`];
}
