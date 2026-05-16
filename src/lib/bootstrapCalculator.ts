import {
  formatCapacitance,
  formatCharge,
  formatPercent,
  formatVoltage,
} from "./units";

export type MethodId = "ti" | "onsemi" | "infineon";
export type Severity = "info" | "warning" | "danger";

export type Message = {
  severity: Severity;
  text: string;
};

export type FormulaLine = {
  label: string;
  expression: string;
  result: string;
};

export type CalculationResult = {
  method: MethodId;
  minimumCboot: number;
  recommendedCboot: number;
  selectedMargin: number | null;
  cvddMinimum: number | null;
  procurement: ProcurementRecommendation;
  lines: FormulaLine[];
  messages: Message[];
};

export type ProcurementRecommendation = {
  value: string;
  voltageRating: string;
  dielectric: string;
  tolerance: string;
  packageHint: string;
  searchQuery: string;
  notes: string[];
};

export type TiInputs = {
  vdd: number;
  diodeDrop: number;
  vhbl: number;
  qg: number;
  ihbs: number;
  ihb: number;
  dmax: number;
  fsw: number;
  selectedCboot?: number;
  cvdd?: number;
  rboot?: number;
};

export type OnsemiInputs = {
  vdd: number;
  diodeDrop: number;
  vgsMin: number;
  qGate: number;
  ilkCap: number;
  ilkGs: number;
  iqbs: number;
  ilk: number;
  ilkDiode: number;
  tOn: number;
  qls: number;
  selectedCboot?: number;
  cvdd?: number;
  vbsMax?: number;
};

export type InfineonInputs = {
  qgStar: number;
  leakage: number;
  fsw: number;
  duty: number;
  rboot: number;
  cboot: number;
  allowedVdrop: number;
  cvdd?: number;
};

const E24_NF = [
  1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9,
  4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
];

export function recommendCapacitor(minimumFarads: number): number {
  if (!Number.isFinite(minimumFarads) || minimumFarads <= 0) {
    return Number.NaN;
  }
  const minimumNf = minimumFarads / 1e-9;
  let decade = 1;
  while (decade * 10 < minimumNf) {
    decade *= 10;
  }
  for (const base of E24_NF) {
    const candidate = base * decade;
    if (candidate >= minimumNf) {
      return candidate * 1e-9;
    }
  }
  return 10 * decade * 1e-9;
}

export function calculateTi(input: TiInputs): CalculationResult {
  const messages: Message[] = [];
  assertPositive(input.vdd, "VDD", messages);
  assertPositive(input.qg, "Qg", messages);
  assertPositive(input.fsw, "fsw", messages);
  assertDuty(input.dmax, "Dmax", messages);

  const gateDriveHeadroom = input.vdd - input.diodeDrop;
  const deltaVhb = input.vdd - input.diodeDrop - input.vhbl;
  if (gateDriveHeadroom <= 0) {
    messages.push({
      severity: "danger",
      text: "VDD minus bootstrap diode drop must be greater than zero.",
    });
  }
  if (deltaVhb <= 0) {
    messages.push({
      severity: "danger",
      text: "Delta VHB is not positive; selected supply, diode, and UVLO/headroom values cannot support the high-side driver.",
    });
  }

  const cg = input.qg / gateDriveHeadroom;
  const ruleOfThumb = 10 * cg;
  const qtotal = input.qg + (input.ihbs * input.dmax) / input.fsw + input.ihb / input.fsw;
  const detailed = qtotal / deltaVhb;
  const minimum = Math.max(ruleOfThumb, detailed);
  const recommended = recommendCapacitor(minimum);
  const cvddMinimum = 10 * (input.selectedCboot ?? recommended);
  const selectedMargin = getMargin(input.selectedCboot, minimum);

  addSharedMessages(messages, input.selectedCboot, minimum, input.cvdd, cvddMinimum);
  if (input.rboot && input.rboot > 10) {
    messages.push({
      severity: "warning",
      text: "Large Rboot limits diode peak current but can slow bootstrap recharge; verify low-side on-time is sufficient.",
    });
  }
  messages.push({
    severity: "info",
    text: "TI guidance is integrated from SLUA887A and E2E practical advice: use both detailed charge budget and the 10x gate-capacitance rule.",
  });

  return {
    method: "ti",
    minimumCboot: minimum,
    recommendedCboot: recommended,
    selectedMargin,
    cvddMinimum,
    procurement: recommendProcurement(recommended, input.vdd),
    messages,
    lines: [
      {
        label: "Equivalent gate capacitance",
        expression: "C_G = Q_G / (V_DD - V_D)",
        result: `${formatCharge(input.qg)} / ${formatVoltage(gateDriveHeadroom)} = ${formatCapacitance(cg)}`,
      },
      {
        label: "Rule-of-thumb bootstrap capacitance",
        expression: "C_BOOT >= 10 x C_G",
        result: `10 * ${formatCapacitance(cg)} = ${formatCapacitance(ruleOfThumb)}`,
      },
      {
        label: "Total high-side charge",
        expression: "Q_TOTAL = Q_G + I_HBS x D_MAX / f_SW + I_HB / f_SW",
        result: `${formatCharge(qtotal)}`,
      },
      {
        label: "Allowed bootstrap drop",
        expression: "Delta V_HB = V_DD - V_DH - V_HBL",
        result: `${formatVoltage(input.vdd)} - ${formatVoltage(input.diodeDrop)} - ${formatVoltage(input.vhbl)} = ${formatVoltage(deltaVhb)}`,
      },
      {
        label: "Detailed bootstrap capacitance",
        expression: "C_BOOT >= Q_TOTAL / Delta V_HB",
        result: `${formatCharge(qtotal)} / ${formatVoltage(deltaVhb)} = ${formatCapacitance(detailed)}`,
      },
      {
        label: "Selected minimum",
        expression: "max(rule-of-thumb, detailed)",
        result: `${formatCapacitance(minimum)}`,
      },
    ],
  };
}

export function calculateOnsemi(input: OnsemiInputs): CalculationResult {
  const messages: Message[] = [];
  assertPositive(input.vdd, "VDD", messages);
  assertPositive(input.qGate, "QGATE", messages);
  assertPositive(input.tOn, "tON", messages);

  const deltaVboot = input.vdd - input.diodeDrop - input.vgsMin;
  if (deltaVboot <= 0) {
    messages.push({
      severity: "danger",
      text: "Delta VBOOT is not positive; VDD, diode drop, and VGSMIN leave no usable bootstrap voltage budget.",
    });
  }
  const leakageCurrent =
    input.ilkCap + input.ilkGs + input.iqbs + input.ilk + input.ilkDiode;
  const qtotal = input.qGate + leakageCurrent * input.tOn + input.qls;
  const minimum = qtotal / deltaVboot;
  const recommended = recommendCapacitor(minimum);
  const cvddMinimum = 10 * (input.selectedCboot ?? recommended);
  const selectedMargin = getMargin(input.selectedCboot, minimum);

  addSharedMessages(messages, input.selectedCboot, minimum, input.cvdd, cvddMinimum);
  if (input.vbsMax && input.vdd > input.vbsMax) {
    messages.push({
      severity: "danger",
      text: "VDD is above the specified VBSMAX. Check bootstrap overcharge and high-side driver absolute maximum ratings.",
    });
  }
  messages.push({
    severity: "warning",
    text: "onsemi AN-6076 notes that VS undershoot can overcharge the bootstrap capacitor; verify VBSMAX under switching transients.",
  });
  messages.push({
    severity: "info",
    text: "Leakage terms depend strongly on temperature and selected parts. Use worst-case datasheet values for final design.",
  });

  return {
    method: "onsemi",
    minimumCboot: minimum,
    recommendedCboot: recommended,
    selectedMargin,
    cvddMinimum,
    procurement: recommendProcurement(recommended, input.vdd),
    messages,
    lines: [
      {
        label: "Allowed bootstrap drop",
        expression: "Delta V_BOOT = V_DD - V_F - V_GS(MIN)",
        result: `${formatVoltage(input.vdd)} - ${formatVoltage(input.diodeDrop)} - ${formatVoltage(input.vgsMin)} = ${formatVoltage(deltaVboot)}`,
      },
      {
        label: "Leakage current sum",
        expression: "I_LEAK = I_LKCAP + I_LKGS + I_QBS + I_LK + I_LKDIODE",
        result: `${formatCharge(leakageCurrent)} / s equivalent current`,
      },
      {
        label: "Total charge",
        expression: "Q_TOTAL = Q_GATE + I_LEAK x t_ON + Q_LS",
        result: `${formatCharge(input.qGate)} + ${formatCharge(leakageCurrent * input.tOn)} + ${formatCharge(input.qls)} = ${formatCharge(qtotal)}`,
      },
      {
        label: "Minimum Cboot",
        expression: "C_BOOT = Q_TOTAL / Delta V_BOOT",
        result: `${formatCharge(qtotal)} / ${formatVoltage(deltaVboot)} = ${formatCapacitance(minimum)}`,
      },
    ],
  };
}

export function calculateInfineon(input: InfineonInputs): CalculationResult {
  const messages: Message[] = [];
  assertPositive(input.qgStar, "QG*", messages);
  assertPositive(input.fsw, "fsw", messages);
  assertPositive(input.rboot, "Rboot", messages);
  assertPositive(input.cboot, "Cboot", messages);
  assertPositive(input.allowedVdrop, "allowed Vdrop", messages);
  assertDuty(input.duty, "Duty", messages);

  const ts = 1 / input.fsw;
  const chargingCurrent = input.qgStar * input.fsw + input.leakage;
  const vRboot = (chargingCurrent / input.duty) * input.rboot;
  const qtot = input.qgStar + input.leakage * (1 - input.duty) * ts;
  const deltaVbs = qtot / input.cboot;
  const vdrop = vRboot + deltaVbs / 2;
  const dmin = (chargingCurrent * input.rboot) / input.allowedVdrop;
  const minimum = qtot / (2 * Math.max(input.allowedVdrop - vRboot, 0));
  const recommended = recommendCapacitor(minimum);
  const cvddMinimum = 10 * input.cboot;
  const selectedMargin = getMargin(input.cboot, minimum);

  if (vdrop > input.allowedVdrop) {
    messages.push({
      severity: "danger",
      text: "Calculated VBS drop exceeds the allowed drop. Increase Cboot, reduce Rboot, reduce leakage, or review duty/frequency.",
    });
  }
  if (input.duty <= dmin) {
    messages.push({
      severity: "warning",
      text: "Duty cycle is at or below the calculated minimum duty boundary for the requested drop budget.",
    });
  }
  addSharedMessages(messages, input.cboot, minimum, input.cvdd, cvddMinimum);
  messages.push({
    severity: "info",
    text: "Infineon method separates Rboot average drop from bootstrap capacitor ripple; verify both at the operating duty-cycle extremes.",
  });

  return {
    method: "infineon",
    minimumCboot: minimum,
    recommendedCboot: recommended,
    selectedMargin,
    cvddMinimum,
    procurement: recommendProcurement(recommended, Math.max(input.allowedVdrop * 2, 12)),
    messages,
    lines: [
      {
        label: "Switching period",
        expression: "T_S = 1 / f_SW",
        result: `${ts.toExponential(4)} s`,
      },
      {
        label: "Rboot voltage drop",
        expression: "V_RBOOT = ((Q_G* x f_SW + I_LEAK) / D) x R_BOOT",
        result: `${formatVoltage(vRboot)}`,
      },
      {
        label: "Bootstrap charge budget",
        expression: "Q_TOTAL = Q_G* + I_LEAK x (1 - D) x T_S",
        result: `${formatCharge(qtot)}`,
      },
      {
        label: "Capacitor ripple",
        expression: "Delta V_BS = Q_TOTAL / C_BOOT",
        result: `${formatCharge(qtot)} / ${formatCapacitance(input.cboot)} = ${formatVoltage(deltaVbs)}`,
      },
      {
        label: "Total VBS drop",
        expression: "V_DROP = V_RBOOT + Delta V_BS / 2",
        result: `${formatVoltage(vRboot)} + ${formatVoltage(deltaVbs)} / 2 = ${formatVoltage(vdrop)}`,
      },
      {
        label: "Minimum duty boundary",
        expression: "D_MIN = ((Q_G* x f_SW + I_LEAK) x R_BOOT) / V_DROP_LIMIT",
        result: `${formatPercent(dmin)}`,
      },
      {
        label: "Minimum Cboot for requested drop limit",
        expression: "C_BOOT >= Q_TOTAL / (2 x (V_DROP_LIMIT - V_RBOOT))",
        result: `${formatCapacitance(minimum)}`,
      },
    ],
  };
}

export function recommendProcurement(
  capacitance: number,
  operatingVoltage: number,
): ProcurementRecommendation {
  const voltageRating = recommendVoltageRating(operatingVoltage);
  const capacitanceText = formatCapacitance(capacitance);
  const dielectric = capacitance >= 1e-6 ? "X7R or X5R MLCC" : "X7R MLCC";
  const tolerance = "+/-10% preferred";
  const packageHint = capacitance >= 1e-6 ? "0805 or larger, verify DC bias" : "0603 or larger";
  const searchQuery = `${capacitanceText} ${voltageRating} X7R ceramic capacitor MLCC`;
  return {
    value: capacitanceText,
    voltageRating,
    dielectric,
    tolerance,
    packageHint,
    searchQuery,
    notes: [
      "Use a voltage rating comfortably above VDD and check DC-bias derating.",
      "Prefer low-ESR ceramic MLCC placed close to the driver bootstrap pins.",
      "Validate actual capacitance at bias, temperature, and package size.",
    ],
  };
}

function recommendVoltageRating(operatingVoltage: number): string {
  const target = Math.max(operatingVoltage * 2, operatingVoltage + 5, 10);
  const ratings = [10, 16, 25, 35, 50, 63, 100, 200];
  return `${ratings.find((rating) => rating >= target) ?? 250}V`;
}

function getMargin(selected: number | undefined, minimum: number): number | null {
  if (!selected || !Number.isFinite(minimum) || minimum <= 0) {
    return null;
  }
  return selected / minimum;
}

function addSharedMessages(
  messages: Message[],
  selected: number | undefined,
  minimum: number,
  cvdd: number | undefined,
  cvddMinimum: number,
): void {
  if (selected && selected < minimum) {
    messages.push({
      severity: "danger",
      text: "Selected Cboot is below the calculated minimum.",
    });
  } else if (selected && selected < minimum * 1.2) {
    messages.push({
      severity: "warning",
      text: "Selected Cboot has less than 20% margin over the calculated minimum.",
    });
  }
  if (cvdd && cvdd < cvddMinimum) {
    messages.push({
      severity: "warning",
      text: "CVDD is below the common 10x Cboot recommendation.",
    });
  }
}

function assertPositive(value: number, name: string, messages: Message[]): void {
  if (!Number.isFinite(value) || value <= 0) {
    messages.push({
      severity: "danger",
      text: `${name} must be greater than zero.`,
    });
  }
}

function assertDuty(value: number, name: string, messages: Message[]): void {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    messages.push({
      severity: "danger",
      text: `${name} must be between 0% and 100%, exclusive.`,
    });
  }
}
