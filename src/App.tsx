import { createElement, memo, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import type { Config, Data, Layout, Shape } from "plotly.js";
import PlotlyBasic from "plotly.js-basic-dist-min";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  BookOpenText,
  Calculator,
  CircuitBoard,
  Copy,
  Download,
  FileCode2,
  FileText,
  Gauge,
  Languages,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Thermometer,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CalculationResult,
  Message,
  MethodId,
  calculateInfineon,
  calculateOnsemi,
  calculateTi,
} from "./lib/bootstrapCalculator";
import {
  BodePoint,
  CompensatorBodePoint,
  CompensatorDesignMode,
  CompensatorResult,
  CompensatorType,
  calculateCompensator,
  formatCompensatorComponent,
  parseBodeCsv,
} from "./lib/compensatorCalculator";
import {
  DigitalCompensatorResult,
  PwmCarrierMode,
  calculateDigitalCompensator,
  formatCoefficient,
} from "./lib/digitalCompensatorCalculator";
import {
  SimetrixComponent,
  SimetrixScriptOptions,
  SimetrixSweepMode,
  countSimetrixRuns,
  generateSimetrixSweepScript,
  normalizeModelList,
  parseSimetrixNetlist,
} from "./lib/simetrixScriptGenerator";
import {
  MosfetThermalInputs,
  MosfetThermalResult,
  calculateMosfetThermalIteration,
} from "./lib/mosfetThermalIteration";
import {
  VerilogAModel,
  VerilogAModelId,
  formatVerilogAParameterAssignments,
  getVerilogAModel,
  verilogAModels,
} from "./lib/verilogAModelLibrary";
import simetrixSpeedGuideMarkdown from "../docs/simetrix/SIMetrix_simulation_speed_guide.md?raw";
import sampleBodeCsv from "../參考資料/bode plot example1.csv?raw";
import type1Circuit from "../參考資料/Type I polished.png";
import type2Circuit from "../參考資料/Type II polished.png";
import type3Circuit from "../參考資料/Type III polished.png";
import {
  formatCapacitance,
  formatFrequency,
  formatGainDb,
  formatPercent,
  formatPhaseDeg,
} from "./lib/units";

type NumericState = Record<string, number>;
type UnitState = Record<string, string>;
type Locale = "zh" | "en";
type FeatureId =
  | "bootstrap"
  | "compensator"
  | "digital-controller"
  | "simetrix"
  | "mosfet-thermal"
  | "simetrix-guide"
  | "rlc-solver"
  | "verilog-a";
type NavFeatureId = FeatureId | "gate" | "rc" | "loss";
type NavGroup = {
  title: Record<Locale, string>;
  items: NavFeatureId[];
};

type UnitOption = {
  label: string;
  factor: number;
};

type MosfetThermalIterationRow = {
  id: number;
  condition: MosfetThermalConditionInputs;
  switchRows: MosfetThermalRecordedSwitchRow[];
  globalNextSimulationTemperatureC: number;
  hottestSwitchRef: string;
  minimumMarginC: number;
};

type MosfetThermalConditionInputs = {
  caseName: string;
  inputVoltageV: number;
  outputVoltageV: number;
  outputPowerW: number;
};

type MosfetThermalSwitchInput = {
  id: number;
  reference: string;
  role: string;
  simulationTemperatureC: number;
  powerLossW: number;
  rthJunctionCase: number;
  rthCaseAmbient: number;
  maxJunctionTemperatureC: number;
};

type MosfetThermalRecordedSwitchRow = {
  input: MosfetThermalSwitchInput;
  result: MosfetThermalResult;
};

const Plot = createPlotlyComponent(PlotlyBasic);

const methodLabels: Record<MethodId, string> = {
  ti: "TI Integrated",
  onsemi: "onsemi AN-6076",
  infineon: "Infineon Network Analysis",
};

const compensatorTypeLabels: Record<CompensatorType, string> = {
  type1: "Type I",
  type2: "Type II",
  type3: "Type III",
};

const compensatorModeLabels: Record<CompensatorDesignMode, string> = {
  auto: "Auto k-factor",
  manual: "Manual pole-zero",
};

const pwmCarrierLabels: Record<PwmCarrierMode, string> = {
  none: "Pure delay only",
  "trailing-edge": "Trailing-edge sawtooth",
  "leading-edge": "Leading-edge sawtooth",
  symmetric: "Symmetric PWM",
};

const digitalParameterKeys = [
  "samplingFrequency",
  "pwmFrequency",
  "pwmUpdateCycles",
  "dutyMin",
  "dutyMax",
  "initialDuty",
  "computationDelaySamples",
  "outputDelaySamples",
  "adcBits",
  "dpwmBits",
];

const featureIcons: Record<NavFeatureId, LucideIcon> = {
  bootstrap: Calculator,
  compensator: Gauge,
  "digital-controller": CircuitBoard,
  simetrix: FileCode2,
  "mosfet-thermal": Thermometer,
  "simetrix-guide": BookOpenText,
  "rlc-solver": CircuitBoard,
  "verilog-a": FileText,
  gate: SlidersHorizontal,
  rc: CircuitBoard,
  loss: Zap,
};

const enabledFeatureIds: FeatureId[] = [
  "bootstrap",
  "compensator",
  "digital-controller",
  "simetrix",
  "mosfet-thermal",
  "verilog-a",
  "simetrix-guide",
  "rlc-solver",
];

const featureNavGroups: NavGroup[] = [
  {
    title: {
      zh: "周邊電路計算",
      en: "Peripheral Circuit Calculations",
    },
    items: ["bootstrap", "compensator", "digital-controller", "gate", "rc", "loss"],
  },
  {
    title: {
      zh: "SIMetrix 工作流",
      en: "SIMetrix Workflow",
    },
    items: ["simetrix", "mosfet-thermal", "verilog-a", "simetrix-guide"],
  },
  {
    title: {
      zh: "電路分析",
      en: "Circuit Analysis",
    },
    items: ["rlc-solver"],
  },
];

function isEnabledFeature(featureId: NavFeatureId): featureId is FeatureId {
  return enabledFeatureIds.includes(featureId as FeatureId);
}

const unitSets: Record<string, UnitOption[]> = {
  voltage: [
    { label: "V", factor: 1 },
    { label: "mV", factor: 1e-3 },
    { label: "kV", factor: 1e3 },
  ],
  charge: [
    { label: "pC", factor: 1e-12 },
    { label: "nC", factor: 1e-9 },
    { label: "uC", factor: 1e-6 },
  ],
  current: [
    { label: "nA", factor: 1e-9 },
    { label: "uA", factor: 1e-6 },
    { label: "mA", factor: 1e-3 },
    { label: "A", factor: 1 },
  ],
  capacitance: [
    { label: "pF", factor: 1e-12 },
    { label: "nF", factor: 1e-9 },
    { label: "uF", factor: 1e-6 },
    { label: "mF", factor: 1e-3 },
  ],
  frequency: [
    { label: "Hz", factor: 1 },
    { label: "kHz", factor: 1e3 },
    { label: "MHz", factor: 1e6 },
  ],
  time: [
    { label: "ns", factor: 1e-9 },
    { label: "us", factor: 1e-6 },
    { label: "ms", factor: 1e-3 },
    { label: "s", factor: 1 },
  ],
  duty: [
    { label: "%", factor: 0.01 },
    { label: "ratio", factor: 1 },
  ],
  resistance: [
    { label: "mohm", factor: 1e-3 },
    { label: "ohm", factor: 1 },
    { label: "kohm", factor: 1e3 },
    { label: "Mohm", factor: 1e6 },
  ],
  phase: [
    { label: "deg", factor: 1 },
  ],
  conductance: [
    { label: "uS", factor: 1e-6 },
    { label: "mS", factor: 1e-3 },
    { label: "S", factor: 1 },
  ],
  gain: [
    { label: "ratio", factor: 1 },
  ],
  count: [
    { label: "count", factor: 1 },
  ],
};

const translations = {
  zh: {
    eyebrow: "周邊電路計算",
    title: "Bootstrap 驅動電容設計",
    subtitle:
      "依 TI、onsemi、Infineon 參考資料分別計算 high-side bootstrap 電容，保留完整公式代入流程與設計警告。",
    compensatorEyebrow: "周邊電路計算",
    compensatorTitle: "迴路補償設計器",
    compensatorSubtitle:
      "匯入 power stage Bode plot，依 Chapter 5 非隔離 op amp 補償器與 Appendix 5B k-factor 方法計算 Type I/II/III 元件。",
    digitalControllerEyebrow: "數位控制設計",
    digitalControllerTitle: "數位控制器設計器",
    digitalControllerSubtitle:
      "沿用最新的類比補償器結果，設定取樣、PWM、delay 與量化參數，並檢查數位 Bode、aliasing 與 SIMPLIS DLL 輸出。",
    simetrixEyebrow: "SIMetrix 工作流",
    simetrixTitle: "SIMetrix 損耗掃描腳本",
    simetrixSubtitle:
      "匯入 SIMetrix netlist，自動偵測 Q/M/S/X 開關候選元件，輸入待比較 model 後產生損耗分析用 .sxscr 腳本。",
    mosfetThermalEyebrow: "SIMetrix 工作流",
    mosfetThermalTitle: "MOSFET 接面溫度迭代",
    mosfetThermalSubtitle:
      "輸入 SIMetrix L1 固定溫度模擬量到的平均損耗與熱阻條件，計算估算 Tj、收斂誤差、安全裕度，以及下一輪建議模擬溫度。",
    simetrixGuideEyebrow: "SIMetrix 工作流",
    simetrixGuideTitle: "SIMetrix 暫態加速指南",
    simetrixGuideSubtitle:
      "整理 transient 模擬過慢、timestep 掉到極小、switching edge 附近不收斂與高頻 ringing 卡住時的排查順序。",
    rlcSolverEyebrow: "電路分析",
    rlcSolverTitle: "RLC 符號分析器",
    rlcSolverSubtitle:
      "貼上 SIMPLIS/SPICE 類 RLC netlist，使用 MNA 在前端求解 .PRINT 電壓/電流輸出，快速取得 s-domain 符號式與元件數值代入結果。",
    verilogAEyebrow: "SIMetrix 工作流",
    verilogATitle: "SIMetrix Verilog-A 模型庫",
    verilogASubtitle:
      "從可重用模型庫挑選控制小功能，檢視參數與原始碼後下載 .va 檔帶回 SIMetrix 使用。",
    language: "語言",
    reset: "重設",
    references: "參考資料",
    referencesNote:
      "公式依廠商來源分開維護；TI 來源只整合相同設計觀念，不混入 onsemi 或 Infineon 方法。",
    formulaTrace: "公式推導",
    designNotes: "設計提醒",
    noCritical: "未偵測到嚴重輸入問題",
    critical: "個嚴重輸入問題",
    procurement: "推薦電容與採購搜尋",
    procurementNote:
      "Digi-Key/Mouser 即時庫存與價格需要 API key；目前先依計算值產生建議規格與搜尋連結。",
    searchDigiKey: "搜尋 Digi-Key",
    searchMouser: "搜尋 Mouser",
    value: "建議容量",
    voltage: "建議耐壓",
    dielectric: "介質",
    tolerance: "公差",
    packageHint: "封裝建議",
    runAnalysis: "執行分析",
    csvInput: "Bode CSV 匯入",
    csvHelp: "欄位固定為 freq,gain,phase；freq 使用 Hz、gain 使用 dB、phase 使用 degree。",
    csvSummary: "資料摘要",
    targetSettings: "Appendix 5B 設計參數",
    componentValues: "補償器元件",
    circuitDiagram: "補償器電路",
    loopMetrics: "k-factor 結果",
    zerosPoles: "補償零極點",
    transferFunction: "補償器轉移函數",
    poleZeroEquations: "零極點數學式",
    compensatorBodePlot: "補償器 Bode 圖",
    plantBodePlot: "功率級 Gp(s) Bode 圖",
    loopGainBodePlot: "補償器 + 功率級 Gc(s)Gp(s) Bode 圖",
    bodeDisplay: "Bode 圖顯示",
    gainMargin: "Gain Margin",
    phaseMargin: "Phase Margin",
    gainCrossover: "Gain crossover",
    phaseCrossover: "Phase crossover",
    calculationSteps: "計算步驟",
    calculationStepsHint: "展開查看 Step 1 到 Step 5 的補償器計算流程、公式與電路圖。",
    crossoverGuide: "虛線說明：f_gc 是 T(s) 穿越 0 dB 的 gain crossover；f_pc 是 T(s) 穿越 -180 deg 的 phase crossover。",
    measurement: "量測",
    markerA: "標記 A",
    markerB: "標記 B",
    chartHelp: "移動游標讀值，點擊設定 A/B 標記，再次點擊重新開始量測。",
    noBodeData: "尚未匯入有效 Bode CSV。",
    pendingTitle: "尚未執行分析",
    pendingBody: "設定參數後按下執行分析，工具才會計算結果、公式推導與設計建議。",
    staleNotice: "參數已變更，請重新執行分析以更新結果。",
    guidance:
      "此工具提供工程估算與公式追溯，最終仍需依 gate driver、MOSFET、diode、電容 DC bias、layout 與實測波形確認。",
    marginPrefix: "目前選用電容比計算最小值高出",
    features: {
      bootstrap: "Bootstrap 驅動電容設計",
      compensator: "迴路補償設計器",
      "digital-controller": "數位控制器設計器",
      simetrix: "SIMetrix 損耗掃描腳本",
      "mosfet-thermal": "MOSFET 接面溫度迭代",
      "simetrix-guide": "SIMetrix 暫態加速指南",
      "rlc-solver": "RLC 符號分析器",
      "verilog-a": "SIMetrix Verilog-A 模型庫",
      gate: "閘極電阻",
      rc: "RC 濾波",
      loss: "功耗計算",
    },
  },
  en: {
    eyebrow: "Peripheral circuit calculations",
    title: "Bootstrap Driver Capacitor Design",
    subtitle:
      "Calculate high-side bootstrap capacitance with TI, onsemi, and Infineon methods, including formula trace and design warnings.",
    compensatorEyebrow: "Peripheral circuit calculations",
    compensatorTitle: "Loop Compensation Designer",
    compensatorSubtitle:
      "Import a power-stage Bode plot, then calculate Type I/II/III non-isolated op amp compensator parts with Chapter 5 and Appendix 5B k-factor equations.",
    digitalControllerEyebrow: "Digital control design",
    digitalControllerTitle: "Digital Controller Designer",
    digitalControllerSubtitle:
      "Convert the latest analog compensator into a sampled controller, then inspect delay, PWM aliasing, digital Bode plots, and SIMPLIS DLL outputs.",
    simetrixEyebrow: "SIMetrix workflow",
    simetrixTitle: "SIMetrix Loss Sweep Script",
    simetrixSubtitle:
      "Import a SIMetrix netlist, detect likely Q/M/S/X switching instances, enter model names, and generate a loss-analysis .sxscr sweep script.",
    mosfetThermalEyebrow: "SIMetrix workflow",
    mosfetThermalTitle: "MOSFET Junction Temperature Iteration",
    mosfetThermalSubtitle:
      "Enter measured average loss from a fixed-temperature SIMetrix L1 run and thermal path values to estimate Tj, convergence error, margin, and the next simulation temperature.",
    simetrixGuideEyebrow: "SIMetrix workflow",
    simetrixGuideTitle: "SIMetrix Transient Speed Guide",
    simetrixGuideSubtitle:
      "A troubleshooting guide for slow transient runs, tiny timesteps, switching-edge convergence issues, and high-frequency ringing.",
    rlcSolverEyebrow: "Circuit analysis",
    rlcSolverTitle: "RLC Symbolic Analyzer",
    rlcSolverSubtitle:
      "Paste a SIMPLIS/SPICE-like RLC netlist and solve .PRINT voltage/current outputs in the browser with MNA, including s-domain expressions and numeric substitution.",
    verilogAEyebrow: "SIMetrix workflow",
    verilogATitle: "SIMetrix Verilog-A Model Library",
    verilogASubtitle:
      "Pick a reusable control utility, inspect its parameters and source, then download the .va file for SIMetrix.",
    language: "Language",
    reset: "Reset",
    references: "References",
    referencesNote:
      "Vendor formulas are kept separate. TI sources are integrated only where the design guidance overlaps.",
    formulaTrace: "Formula Trace",
    designNotes: "Design Notes",
    noCritical: "No critical input issues detected",
    critical: "critical input issue(s)",
    procurement: "Recommended Capacitor And Distributor Search",
    procurementNote:
      "Live Digi-Key/Mouser stock and pricing require API keys. This static app generates recommended specs and search links.",
    searchDigiKey: "Search Digi-Key",
    searchMouser: "Search Mouser",
    value: "Recommended value",
    voltage: "Voltage rating",
    dielectric: "Dielectric",
    tolerance: "Tolerance",
    packageHint: "Package hint",
    runAnalysis: "Run analysis",
    csvInput: "Bode CSV Import",
    csvHelp: "Required columns are freq,gain,phase; freq in Hz, gain in dB, phase in degrees.",
    csvSummary: "Data Summary",
    targetSettings: "Appendix 5B Design Parameters",
    componentValues: "Compensator Components",
    circuitDiagram: "Compensator Circuit",
    loopMetrics: "k-factor Results",
    zerosPoles: "Compensator Zeros And Poles",
    transferFunction: "Compensator Transfer Function",
    poleZeroEquations: "Pole-Zero Equations",
    compensatorBodePlot: "Compensator Bode Plot",
    plantBodePlot: "Power Stage Gp(s) Bode Plot",
    loopGainBodePlot: "Compensator + Power Stage Gc(s)Gp(s) Bode Plot",
    bodeDisplay: "Bode Plot Display",
    gainMargin: "Gain Margin",
    phaseMargin: "Phase Margin",
    gainCrossover: "Gain crossover",
    phaseCrossover: "Phase crossover",
    calculationSteps: "Calculation Steps",
    calculationStepsHint: "Expand to inspect Step 1 through Step 5, formulas, k-factor values, and the circuit image.",
    crossoverGuide: "Dashed lines: f_gc is where T(s) crosses 0 dB; f_pc is where T(s) crosses -180 deg.",
    measurement: "Measurement",
    markerA: "Marker A",
    markerB: "Marker B",
    chartHelp: "Move the pointer to read values. Click to set A/B markers; click again to restart measurement.",
    noBodeData: "No valid Bode CSV has been imported yet.",
    pendingTitle: "Analysis has not run yet",
    pendingBody: "Set the parameters, then run analysis to calculate results, formula trace, and design guidance.",
    staleNotice: "Parameters changed. Run analysis again to update the result.",
    guidance:
      "Engineering guidance only. Verify final values with gate-driver limits, MOSFET data, diode stress, capacitor DC bias, layout, and measured waveforms.",
    marginPrefix: "Selected capacitance margin above calculated minimum:",
    features: {
      bootstrap: "Bootstrap driver capacitor",
      compensator: "Loop compensation designer",
      "digital-controller": "Digital controller designer",
      simetrix: "SIMetrix loss sweep script",
      "mosfet-thermal": "MOSFET Tj iteration",
      "simetrix-guide": "SIMetrix transient speed guide",
      "rlc-solver": "RLC symbolic analyzer",
      "verilog-a": "SIMetrix Verilog-A models",
      gate: "Gate resistor",
      rc: "RC filter",
      loss: "Power loss",
    },
  },
};

const fieldLabels = {
  zh: {
    vdd: "V_DD 驅動供應電壓",
    diodeDrop: "V_D / V_F Bootstrap 二極體壓降",
    vhbl: "V_HBL 高側 UVLO/最低電壓",
    vgsMin: "V_GS(MIN) 最小閘極電壓",
    vbsMax: "V_BS(MAX) 最大 bootstrap 電壓",
    allowedVdrop: "V_DROP_LIMIT 允許 V_BS 壓降",
    qg: "Q_G MOSFET 閘極電荷",
    qGate: "Q_GATE MOSFET 閘極電荷",
    qls: "Q_LS 位準轉換電荷",
    qgStar: "Q_G* 有效閘極電荷",
    ihbs: "I_HBS 高側偏壓電流",
    ihb: "I_HB 高側漏電流",
    ilkCap: "I_LKCAP Bootstrap 電容漏電",
    ilkGs: "I_LKGS Gate-source 漏電",
    iqbs: "I_QBS 高側靜態電流",
    ilk: "I_LK Driver 漏電",
    ilkDiode: "I_LKDIODE 二極體漏電",
    leakage: "I_LEAK 總漏電流",
    fsw: "f_SW 開關頻率",
    tOn: "t_ON 高側導通時間",
    dmax: "D_MAX 最大 duty cycle",
    duty: "D Duty cycle",
    selectedCboot: "C_BOOT 已選 bootstrap 電容",
    cboot: "C_BOOT 已選 bootstrap 電容",
    cvdd: "C_VDD VDD 旁路電容",
    rboot: "R_BOOT Bootstrap 電阻",
    crossoverFrequency: "f_C 交越頻率",
    targetPhaseMargin: "PM_TARGET 目標相位裕度",
    r1: "R1 補償器輸入電阻",
    resonantFrequency: "f_0 LC 諧振頻率",
    switchingFrequency: "f_SW 開關頻率",
    originPoleFrequency: "f_p0 原點極點交越頻率",
    zeroFrequency: "f_z 零點頻率",
    poleFrequency: "f_p 極點頻率",
    zeroFrequency1: "f_z1 第一零點頻率",
    zeroFrequency2: "f_z2 第二零點頻率",
    poleFrequency1: "f_p1 第一極點頻率",
    poleFrequency2: "f_p2 第二極點頻率",
    samplingFrequency: "f_s 數位控制器取樣頻率",
    pwmFrequency: "f_PWM PWM carrier 頻率",
    pwmUpdateCycles: "PWM_UPDATE_CYCLES 更新週期數",
    dutyMin: "DUTY_MIN 最小 duty",
    dutyMax: "DUTY_MAX 最大 duty",
    initialDuty: "INITIAL_DUTY 初始 duty",
    computationDelaySamples: "COMPUTE_DELAY 計算延遲",
    outputDelaySamples: "OUTPUT_DELAY 輸出延遲",
    adcBits: "ADC_BITS 解析度",
    dpwmBits: "DPWM_BITS 解析度",
  },
  en: {
    vdd: "V_DD driver supply",
    diodeDrop: "V_D / V_F bootstrap diode drop",
    vhbl: "V_HBL high-side UVLO/minimum voltage",
    vgsMin: "V_GS(MIN) minimum gate voltage",
    vbsMax: "V_BS(MAX) maximum bootstrap voltage",
    allowedVdrop: "V_DROP_LIMIT allowed V_BS drop",
    qg: "Q_G MOSFET gate charge",
    qGate: "Q_GATE MOSFET gate charge",
    qls: "Q_LS level-shift charge",
    qgStar: "Q_G* effective gate charge",
    ihbs: "I_HBS high-side bias current",
    ihb: "I_HB high-side leakage",
    ilkCap: "I_LKCAP bootstrap capacitor leakage",
    ilkGs: "I_LKGS gate-source leakage",
    iqbs: "I_QBS high-side quiescent current",
    ilk: "I_LK driver leakage",
    ilkDiode: "I_LKDIODE diode leakage",
    leakage: "I_LEAK total leakage",
    fsw: "f_SW switching frequency",
    tOn: "t_ON high-side on-time",
    dmax: "D_MAX maximum duty cycle",
    duty: "D duty cycle",
    selectedCboot: "C_BOOT selected bootstrap capacitor",
    cboot: "C_BOOT selected bootstrap capacitor",
    cvdd: "C_VDD VDD bypass capacitor",
    rboot: "R_BOOT bootstrap resistor",
    crossoverFrequency: "f_C crossover frequency",
    targetPhaseMargin: "PM_TARGET target phase margin",
    r1: "R1 compensator input resistor",
    resonantFrequency: "f_0 LC resonant frequency",
    switchingFrequency: "f_SW switching frequency",
    originPoleFrequency: "f_p0 origin-pole crossover",
    zeroFrequency: "f_z zero frequency",
    poleFrequency: "f_p pole frequency",
    zeroFrequency1: "f_z1 first zero frequency",
    zeroFrequency2: "f_z2 second zero frequency",
    poleFrequency1: "f_p1 first pole frequency",
    poleFrequency2: "f_p2 second pole frequency",
    samplingFrequency: "f_s digital sampling frequency",
    pwmFrequency: "f_PWM PWM carrier frequency",
    pwmUpdateCycles: "PWM_UPDATE_CYCLES update cadence",
    dutyMin: "DUTY_MIN minimum duty",
    dutyMax: "DUTY_MAX maximum duty",
    initialDuty: "INITIAL_DUTY initial duty",
    computationDelaySamples: "COMPUTE_DELAY compute delay",
    outputDelaySamples: "OUTPUT_DELAY output delay",
    adcBits: "ADC_BITS resolution",
    dpwmBits: "DPWM_BITS resolution",
  },
};

const fieldUnits: Record<string, string> = {
  vdd: "voltage",
  diodeDrop: "voltage",
  vhbl: "voltage",
  vgsMin: "voltage",
  vbsMax: "voltage",
  allowedVdrop: "voltage",
  qg: "charge",
  qGate: "charge",
  qls: "charge",
  qgStar: "charge",
  ihbs: "current",
  ihb: "current",
  ilkCap: "current",
  ilkGs: "current",
  iqbs: "current",
  ilk: "current",
  ilkDiode: "current",
  leakage: "current",
  fsw: "frequency",
  tOn: "time",
  dmax: "duty",
  duty: "duty",
  selectedCboot: "capacitance",
  cboot: "capacitance",
  cvdd: "capacitance",
  rboot: "resistance",
  crossoverFrequency: "frequency",
  targetPhaseMargin: "phase",
  r1: "resistance",
  resonantFrequency: "frequency",
  switchingFrequency: "frequency",
  originPoleFrequency: "frequency",
  zeroFrequency: "frequency",
  poleFrequency: "frequency",
  zeroFrequency1: "frequency",
  zeroFrequency2: "frequency",
  poleFrequency1: "frequency",
  poleFrequency2: "frequency",
  samplingFrequency: "frequency",
  pwmFrequency: "frequency",
  pwmUpdateCycles: "count",
  dutyMin: "duty",
  dutyMax: "duty",
  initialDuty: "duty",
  computationDelaySamples: "count",
  outputDelaySamples: "count",
  adcBits: "count",
  dpwmBits: "count",
};

const defaultUnits: Record<MethodId, UnitState> = {
  ti: {
    vdd: "V",
    diodeDrop: "V",
    vhbl: "V",
    qg: "nC",
    ihbs: "uA",
    ihb: "uA",
    dmax: "%",
    fsw: "kHz",
    selectedCboot: "nF",
    cvdd: "uF",
    rboot: "ohm",
  },
  onsemi: {
    vdd: "V",
    diodeDrop: "V",
    vgsMin: "V",
    qGate: "nC",
    ilkCap: "uA",
    ilkGs: "uA",
    iqbs: "uA",
    ilk: "uA",
    ilkDiode: "uA",
    tOn: "us",
    qls: "nC",
    selectedCboot: "nF",
    cvdd: "uF",
    vbsMax: "V",
  },
  infineon: {
    qgStar: "nC",
    leakage: "uA",
    fsw: "kHz",
    duty: "%",
    rboot: "ohm",
    cboot: "nF",
    allowedVdrop: "V",
    cvdd: "uF",
  },
};

const defaults: Record<MethodId, NumericState> = {
  ti: {
    vdd: 12,
    diodeDrop: 0.7,
    vhbl: 8,
    qg: 50,
    ihbs: 100,
    ihb: 20,
    dmax: 80,
    fsw: 100,
    selectedCboot: 100,
    cvdd: 2.2,
    rboot: 2,
  },
  onsemi: {
    vdd: 12,
    diodeDrop: 0.7,
    vgsMin: 8,
    qGate: 50,
    ilkCap: 1,
    ilkGs: 1,
    iqbs: 150,
    ilk: 2,
    ilkDiode: 1,
    tOn: 10,
    qls: 5,
    selectedCboot: 100,
    cvdd: 2.2,
    vbsMax: 20,
  },
  infineon: {
    qgStar: 50,
    leakage: 100,
    fsw: 100,
    duty: 50,
    rboot: 2,
    cboot: 100,
    allowedVdrop: 0.5,
    cvdd: 2.2,
  },
};

const defaultCompensatorValues: NumericState = {
  crossoverFrequency: 10,
  targetPhaseMargin: 60,
  r1: 10,
  resonantFrequency: 2,
  switchingFrequency: 100,
  originPoleFrequency: 10,
  zeroFrequency: 3,
  poleFrequency: 30,
  zeroFrequency1: 2,
  zeroFrequency2: 8,
  poleFrequency1: 50,
  poleFrequency2: 50,
  samplingFrequency: 100,
  pwmFrequency: 100,
  pwmUpdateCycles: 1,
  dutyMin: 2,
  dutyMax: 95,
  initialDuty: 10,
  computationDelaySamples: 0,
  outputDelaySamples: 1,
  adcBits: 12,
  dpwmBits: 10,
};

const defaultCompensatorUnits: UnitState = {
  crossoverFrequency: "kHz",
  targetPhaseMargin: "deg",
  r1: "kohm",
  resonantFrequency: "kHz",
  switchingFrequency: "kHz",
  originPoleFrequency: "kHz",
  zeroFrequency: "kHz",
  poleFrequency: "kHz",
  zeroFrequency1: "kHz",
  zeroFrequency2: "kHz",
  poleFrequency1: "kHz",
  poleFrequency2: "kHz",
  samplingFrequency: "kHz",
  pwmFrequency: "kHz",
  pwmUpdateCycles: "count",
  dutyMin: "%",
  dutyMax: "%",
  initialDuty: "%",
  computationDelaySamples: "count",
  outputDelaySamples: "count",
  adcBits: "count",
  dpwmBits: "count",
};

const defaultMosfetThermalInputs: MosfetThermalInputs = {
  ambientTemperatureC: 50,
  simulationTemperatureC: 50,
  powerLossW: 3.2,
  rthJunctionCase: 0.8,
  rthCaseAmbient: 12,
  maxJunctionTemperatureC: 150,
  relaxationFactor: 0.6,
  toleranceC: 1,
};

const defaultMosfetThermalSwitchRows: MosfetThermalSwitchInput[] = [
  {
    id: 1,
    reference: "QH1",
    role: "HS",
    simulationTemperatureC: 50,
    powerLossW: 3.2,
    rthJunctionCase: 0.8,
    rthCaseAmbient: 12,
    maxJunctionTemperatureC: 150,
  },
  {
    id: 2,
    reference: "QL1",
    role: "LS",
    simulationTemperatureC: 50,
    powerLossW: 5.8,
    rthJunctionCase: 0.8,
    rthCaseAmbient: 12,
    maxJunctionTemperatureC: 150,
  },
];

const defaultMosfetThermalCondition: MosfetThermalConditionInputs = {
  caseName: "60V / 12V / 2.5kW",
  inputVoltageV: 60,
  outputVoltageV: 12,
  outputPowerW: 2500,
};

const sourceLinks = [
  {
    vendor: "TI",
    label: "SLUA887A",
    href: "https://www.ti.com/lit/an/slua887a/slua887a.pdf",
    note: "Rule-of-thumb, detailed charge budget, CVDD guidance.",
  },
  {
    vendor: "TI",
    label: "E2E LM5106 discussion",
    href: "https://e2e.ti.com/support/power-management-group/power-management/f/power-management-forum/514747/bootstrap-capacitor-voltage-drop-lm5106",
    note: "Practical 10x charge and Rboot guidance.",
  },
  {
    vendor: "onsemi",
    label: "AN-6076",
    href: "https://www.onsemi.com/pub/collateral/an-6076.pdf",
    note: "QTOTAL and Delta VBOOT sizing method.",
  },
  {
    vendor: "Infineon",
    label: "Bootstrap Network Analysis",
    href: "https://www.infineon.com/assets/row/public/documents/cross-divisions/42/infineon-bootstrap-network-analysis-applicationnotes-en.pdf",
    note: "Rboot drop, ripple, and duty-cycle constraints.",
  },
];

function getFeatureHeader(feature: FeatureId, locale: Locale) {
  const t = translations[locale];
  if (feature === "bootstrap") {
    return { eyebrow: t.eyebrow, title: t.title, subtitle: t.subtitle };
  }
  if (feature === "compensator") {
    return {
      eyebrow: t.compensatorEyebrow,
      title: t.compensatorTitle,
      subtitle: t.compensatorSubtitle,
    };
  }
  if (feature === "digital-controller") {
    return {
      eyebrow: t.digitalControllerEyebrow,
      title: t.digitalControllerTitle,
      subtitle: t.digitalControllerSubtitle,
    };
  }
  if (feature === "verilog-a") {
    return {
      eyebrow: t.verilogAEyebrow,
      title: t.verilogATitle,
      subtitle: t.verilogASubtitle,
    };
  }
  if (feature === "rlc-solver") {
    return {
      eyebrow: t.rlcSolverEyebrow,
      title: t.rlcSolverTitle,
      subtitle: t.rlcSolverSubtitle,
    };
  }
  if (feature === "simetrix-guide") {
    return {
      eyebrow: t.simetrixGuideEyebrow,
      title: t.simetrixGuideTitle,
      subtitle: t.simetrixGuideSubtitle,
    };
  }
  if (feature === "mosfet-thermal") {
    return {
      eyebrow: t.mosfetThermalEyebrow,
      title: t.mosfetThermalTitle,
      subtitle: t.mosfetThermalSubtitle,
    };
  }
  return {
    eyebrow: t.simetrixEyebrow,
    title: t.simetrixTitle,
    subtitle: t.simetrixSubtitle,
  };
}

export function App() {
  const [feature, setFeature] = useState<FeatureId>("bootstrap");
  const [locale, setLocale] = useState<Locale>("zh");
  const [method, setMethod] = useState<MethodId>("ti");
  const [values, setValues] = useState<Record<MethodId, NumericState>>(defaults);
  const [units, setUnits] = useState<Record<MethodId, UnitState>>(defaultUnits);
  const [analysis, setAnalysis] = useState<CalculationResult | null>(null);
  const [analysisDirty, setAnalysisDirty] = useState(false);
  const [compensatorType, setCompensatorType] = useState<CompensatorType>("type2");
  const [compensatorMode, setCompensatorMode] = useState<CompensatorDesignMode>("auto");
  const [pwmCarrier, setPwmCarrier] = useState<PwmCarrierMode>("trailing-edge");
  const [compValues, setCompValues] = useState<NumericState>(defaultCompensatorValues);
  const [compUnits, setCompUnits] = useState<UnitState>(defaultCompensatorUnits);
  const [csvText, setCsvText] = useState(sampleBodeCsv);
  const [bodePoints, setBodePoints] = useState<BodePoint[]>(parseBodeCsv(sampleBodeCsv).points);
  const [csvMessages, setCsvMessages] = useState(parseBodeCsv(sampleBodeCsv).messages);
  const [compAnalysis, setCompAnalysis] = useState<CompensatorResult | null>(null);
  const [compAnalysisDirty, setCompAnalysisDirty] = useState(false);
  const [simetrixNetlistText, setSimetrixNetlistText] = useState("");
  const [simetrixComponents, setSimetrixComponents] = useState<SimetrixComponent[]>([]);
  const [selectedSimetrixRefs, setSelectedSimetrixRefs] = useState<string[]>([]);
  const [simetrixModelsText, setSimetrixModelsText] = useState("IGC033S101_L1\nIGC025S08S1_L1");
  const [simetrixSweepMode, setSimetrixSweepMode] = useState<SimetrixSweepMode>("same-model");
  const [simetrixNetlistFileName, setSimetrixNetlistFileName] = useState("design.net");
  const [createSimetrixNetlist, setCreateSimetrixNetlist] = useState(true);
  const [mosfetThermalInputs, setMosfetThermalInputs] = useState<MosfetThermalInputs>(
    defaultMosfetThermalInputs,
  );
  const [mosfetThermalSwitchRows, setMosfetThermalSwitchRows] = useState<MosfetThermalSwitchInput[]>(
    defaultMosfetThermalSwitchRows,
  );
  const [mosfetThermalCondition, setMosfetThermalCondition] = useState<MosfetThermalConditionInputs>(
    defaultMosfetThermalCondition,
  );
  const [mosfetThermalHistory, setMosfetThermalHistory] = useState<MosfetThermalIterationRow[]>([]);
  const [verilogAModelId, setVerilogAModelId] = useState<VerilogAModelId>("deadtime-generator");
  const activeValues = values[method];
  const activeUnits = units[method];
  const t = translations[locale];
  const featureHeader = getFeatureHeader(feature, locale);
  function updateValue(key: string, value: number) {
    setValues((current) => ({
      ...current,
      [method]: {
        ...current[method],
        [key]: value,
      },
    }));
    setAnalysisDirty(true);
  }

  function updateUnit(key: string, nextUnit: string) {
    const oldUnit = activeUnits[key];
    const siValue = toSi(activeValues[key], oldUnit);
    const nextValue = fromSi(siValue, nextUnit);
    setUnits((current) => ({
      ...current,
      [method]: {
        ...current[method],
        [key]: nextUnit,
      },
    }));
    setValues((current) => ({
      ...current,
      [method]: {
        ...current[method],
        [key]: Number(nextValue.toPrecision(8)),
      },
    }));
    setAnalysisDirty(true);
  }

  function updateCompValue(key: string, value: number) {
    setCompValues((current) => ({ ...current, [key]: value }));
    setCompAnalysisDirty(true);
  }

  function updateDigitalValue(key: string, value: number) {
    setCompValues((current) => ({ ...current, [key]: value }));
  }

  function updateCompUnit(key: string, nextUnit: string) {
    const oldUnit = compUnits[key];
    const siValue = toSi(compValues[key], oldUnit);
    const nextValue = fromSi(siValue, nextUnit);
    setCompUnits((current) => ({ ...current, [key]: nextUnit }));
    setCompValues((current) => ({ ...current, [key]: Number(nextValue.toPrecision(8)) }));
    setCompAnalysisDirty(true);
  }

  function updateDigitalUnit(key: string, nextUnit: string) {
    const oldUnit = compUnits[key];
    const siValue = toSi(compValues[key], oldUnit);
    const nextValue = fromSi(siValue, nextUnit);
    setCompUnits((current) => ({ ...current, [key]: nextUnit }));
    setCompValues((current) => ({ ...current, [key]: Number(nextValue.toPrecision(8)) }));
  }

  function updateCsv(text: string) {
    const parsed = parseBodeCsv(text);
    setCsvText(text);
    setBodePoints(parsed.points);
    setCsvMessages(parsed.messages);
    setCompAnalysisDirty(true);
  }

  async function importCsvFile(file: File | null) {
    if (!file) {
      return;
    }
    updateCsv(await file.text());
  }

  async function importSimetrixFile(file: File | null) {
    if (!file) {
      return;
    }
    setSimetrixNetlistFileName(file.name);
    updateSimetrixNetlist(await file.text());
  }

  function updateSimetrixNetlist(text: string) {
    const parsed = parseSimetrixNetlist(text);
    setSimetrixNetlistText(text);
    setSimetrixComponents(parsed.components);
    setSelectedSimetrixRefs(parsed.components.map((component) => component.reference));
  }

  function toggleSimetrixReference(reference: string) {
    setSelectedSimetrixRefs((current) =>
      current.includes(reference)
        ? current.filter((item) => item !== reference)
        : [...current, reference],
    );
  }

  function resetSimetrix() {
    setSimetrixNetlistText("");
    setSimetrixComponents([]);
    setSelectedSimetrixRefs([]);
    setSimetrixModelsText("IGC033S101_L1\nIGC025S08S1_L1");
    setSimetrixSweepMode("same-model");
    setSimetrixNetlistFileName("design.net");
    setCreateSimetrixNetlist(true);
  }

  function updateMosfetThermalInput(key: keyof MosfetThermalInputs, value: number) {
    setMosfetThermalInputs((current) => ({ ...current, [key]: value }));
  }

  function updateMosfetThermalSwitch<K extends keyof MosfetThermalSwitchInput>(
    id: number,
    key: K,
    value: MosfetThermalSwitchInput[K],
  ) {
    setMosfetThermalSwitchRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  }

  function addMosfetThermalSwitch() {
    setMosfetThermalSwitchRows((current) => {
      const nextId = current.reduce((maxId, row) => Math.max(maxId, row.id), 0) + 1;
      return [
        ...current,
        {
          id: nextId,
          reference: `Q${nextId}`,
          role: "SW",
          simulationTemperatureC: mosfetThermalInputs.simulationTemperatureC,
          powerLossW: 0,
          rthJunctionCase: mosfetThermalInputs.rthJunctionCase,
          rthCaseAmbient: mosfetThermalInputs.rthCaseAmbient,
          maxJunctionTemperatureC: mosfetThermalInputs.maxJunctionTemperatureC,
        },
      ];
    });
  }

  function removeMosfetThermalSwitch(id: number) {
    setMosfetThermalSwitchRows((current) => current.filter((row) => row.id !== id));
  }

  function updateMosfetThermalCondition<K extends keyof MosfetThermalConditionInputs>(
    key: K,
    value: MosfetThermalConditionInputs[K],
  ) {
    setMosfetThermalCondition((current) => ({ ...current, [key]: value }));
  }

  function resetMosfetThermal() {
    setMosfetThermalInputs(defaultMosfetThermalInputs);
    setMosfetThermalSwitchRows(defaultMosfetThermalSwitchRows);
    setMosfetThermalCondition(defaultMosfetThermalCondition);
    setMosfetThermalHistory([]);
  }

  function recordMosfetThermalIteration() {
    const recordedSwitchRows = mosfetThermalSwitchRows.map((row) => {
      const result = calculateMosfetThermalIteration(buildSwitchThermalInputs(row, mosfetThermalInputs));
      return {
        input: { ...row, simulationTemperatureC: mosfetThermalInputs.simulationTemperatureC },
        result,
      };
    });
    const validRows = recordedSwitchRows.filter((row) => row.result.status !== "invalid");
    const globalNextSimulationTemperatureC =
      validRows.length > 0
        ? Math.max(...validRows.map((row) => row.result.nextSimulationTemperatureC))
        : Number.NaN;
    const hottestRow = validRows.reduce<MosfetThermalRecordedSwitchRow | null>(
      (current, row) =>
        !current || row.result.estimatedJunctionTemperatureC > current.result.estimatedJunctionTemperatureC
          ? row
          : current,
      null,
    );
    const minimumMarginC =
      validRows.length > 0 ? Math.min(...validRows.map((row) => row.result.marginC)) : Number.NaN;
    setMosfetThermalHistory((current) => [
      ...current,
      {
        id: current.length + 1,
        condition: { ...mosfetThermalCondition },
        switchRows: recordedSwitchRows,
        globalNextSimulationTemperatureC,
        hottestSwitchRef: hottestRow?.input.reference ?? "N/A",
        minimumMarginC,
      },
    ]);
  }

  function clearMosfetThermalHistory() {
    setMosfetThermalHistory([]);
  }

  function resetMethod() {
    setValues((current) => ({ ...current, [method]: defaults[method] }));
    setUnits((current) => ({ ...current, [method]: defaultUnits[method] }));
    setAnalysis(null);
    setAnalysisDirty(false);
  }

  function resetCompensator() {
    const parsed = parseBodeCsv(sampleBodeCsv);
    setCompensatorType("type2");
    setCompensatorMode("auto");
    setPwmCarrier("trailing-edge");
    setCompValues(defaultCompensatorValues);
    setCompUnits(defaultCompensatorUnits);
    setCsvText(sampleBodeCsv);
    setBodePoints(parsed.points);
    setCsvMessages(parsed.messages);
    setCompAnalysis(null);
    setCompAnalysisDirty(false);
  }

  function switchMethod(nextMethod: MethodId) {
    setMethod(nextMethod);
    setAnalysis(null);
    setAnalysisDirty(false);
  }

  function runAnalysis() {
    setAnalysis(calculate(method, activeValues, activeUnits));
    setAnalysisDirty(false);
  }

  function runCompensatorAnalysis() {
    setCompAnalysis(
      calculateCompensator({
        bodePoints,
        compensatorType,
        designMode: compensatorMode,
        crossoverFrequency: toSi(compValues.crossoverFrequency, compUnits.crossoverFrequency),
        targetPhaseMargin:
          compensatorType === "type1"
            ? undefined
            : toSi(compValues.targetPhaseMargin, compUnits.targetPhaseMargin),
        r1: toSi(compValues.r1, compUnits.r1),
        resonantFrequency:
          compensatorType === "type3"
            ? toSi(compValues.resonantFrequency, compUnits.resonantFrequency)
            : undefined,
        switchingFrequency:
          compensatorType === "type3"
            ? toSi(compValues.switchingFrequency, compUnits.switchingFrequency)
            : undefined,
        originPoleFrequency:
          compensatorMode === "manual" && compensatorType === "type1"
            ? toSi(compValues.originPoleFrequency, compUnits.originPoleFrequency)
            : undefined,
        zeroFrequency:
          compensatorMode === "manual" && compensatorType === "type2"
            ? toSi(compValues.zeroFrequency, compUnits.zeroFrequency)
            : undefined,
        poleFrequency:
          compensatorMode === "manual" && compensatorType === "type2"
            ? toSi(compValues.poleFrequency, compUnits.poleFrequency)
            : undefined,
        zeroFrequency1:
          compensatorMode === "manual" && compensatorType === "type3"
            ? toSi(compValues.zeroFrequency1, compUnits.zeroFrequency1)
            : undefined,
        zeroFrequency2:
          compensatorMode === "manual" && compensatorType === "type3"
            ? toSi(compValues.zeroFrequency2, compUnits.zeroFrequency2)
            : undefined,
        poleFrequency1:
          compensatorMode === "manual" && compensatorType === "type3"
            ? toSi(compValues.poleFrequency1, compUnits.poleFrequency1)
            : undefined,
        poleFrequency2:
          compensatorMode === "manual" && compensatorType === "type3"
            ? toSi(compValues.poleFrequency2, compUnits.poleFrequency2)
            : undefined,
      }),
    );
    setCompAnalysisDirty(false);
  }

  return (
    <div className="app-frame">
      <aside className="feature-nav" aria-label="EE Tool features">
        <div className="brand-block">
          <span>EE</span>
          <div>
            <strong>EE Tool</strong>
            <small>Power Electronics Workbench</small>
          </div>
        </div>
        <nav>
          {featureNavGroups.map((group) => (
            <div className="feature-group" key={group.title.en}>
              <p className="feature-group-title">{group.title[locale]}</p>
              <div className="feature-group-items">
                {group.items.map((item) => {
                  const Icon = featureIcons[item];
                  const enabled = isEnabledFeature(item);
                  return (
                    <button
                      className={enabled && feature === item ? "active" : ""}
                      disabled={!enabled}
                      key={item}
                      type="button"
                      onClick={() => {
                        if (enabled) {
                          setFeature(item);
                        }
                      }}
                    >
                      <Icon aria-hidden="true" size={18} />
                      {t.features[item]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="app-shell">
        <section className="tool-header">
          <div>
            <p className="eyebrow">{featureHeader.eyebrow}</p>
            <h1>{featureHeader.title}</h1>
            <p className="subtitle">{featureHeader.subtitle}</p>
          </div>
          <label className="language-switch">
            <span>
              <Languages aria-hidden="true" size={16} />
              {t.language}
            </span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              <option value="zh">Traditional Chinese</option>
              <option value="en">English</option>
            </select>
          </label>
        </section>

        {feature === "bootstrap" ? (
          <BootstrapWorkspace
            locale={locale}
            method={method}
            values={activeValues}
            units={activeUnits}
            analysis={analysis}
            analysisDirty={analysisDirty}
            onMethodChange={switchMethod}
            onValueChange={updateValue}
            onUnitChange={updateUnit}
            onReset={resetMethod}
            onRun={runAnalysis}
          />
        ) : feature === "compensator" ? (
          <CompensatorWorkspace
            locale={locale}
            compensatorType={compensatorType}
            compensatorMode={compensatorMode}
            values={compValues}
            units={compUnits}
            csvText={csvText}
            bodePoints={bodePoints}
            csvMessages={csvMessages}
            analysis={compAnalysis}
            analysisDirty={compAnalysisDirty}
            onCompensatorTypeChange={(nextType) => {
              setCompensatorType(nextType);
              setCompAnalysisDirty(true);
            }}
            onCompensatorModeChange={(nextMode) => {
              setCompensatorMode(nextMode);
              setCompAnalysisDirty(true);
            }}
            onValueChange={updateCompValue}
            onUnitChange={updateCompUnit}
            onCsvChange={updateCsv}
            onFileImport={importCsvFile}
            onReset={resetCompensator}
            onRun={runCompensatorAnalysis}
          />
        ) : feature === "digital-controller" ? (
          <DigitalControllerWorkspace
            locale={locale}
            analogResult={compAnalysis}
            analogDirty={compAnalysisDirty}
            values={compValues}
            units={compUnits}
            pwmCarrier={pwmCarrier}
            onPwmCarrierChange={setPwmCarrier}
            onValueChange={updateDigitalValue}
            onUnitChange={updateDigitalUnit}
            onOpenAnalog={() => setFeature("compensator")}
          />
        ) : feature === "simetrix" ? (
          <SimetrixWorkspace
            components={simetrixComponents}
            selectedReferences={selectedSimetrixRefs}
            modelText={simetrixModelsText}
            netlistText={simetrixNetlistText}
            mode={simetrixSweepMode}
            netlistFileName={simetrixNetlistFileName}
            createNetlistBeforeRun={createSimetrixNetlist}
            onFileImport={importSimetrixFile}
            onNetlistTextChange={updateSimetrixNetlist}
            onReferenceToggle={toggleSimetrixReference}
            onModelTextChange={setSimetrixModelsText}
            onModeChange={setSimetrixSweepMode}
            onNetlistFileNameChange={setSimetrixNetlistFileName}
            onCreateNetlistBeforeRunChange={setCreateSimetrixNetlist}
            onReset={resetSimetrix}
          />
        ) : feature === "mosfet-thermal" ? (
          <MosfetThermalWorkspace
            locale={locale}
            inputs={mosfetThermalInputs}
            switchRows={mosfetThermalSwitchRows}
            condition={mosfetThermalCondition}
            history={mosfetThermalHistory}
            onInputChange={updateMosfetThermalInput}
            onSwitchChange={updateMosfetThermalSwitch}
            onAddSwitch={addMosfetThermalSwitch}
            onRemoveSwitch={removeMosfetThermalSwitch}
            onConditionChange={updateMosfetThermalCondition}
            onRecord={recordMosfetThermalIteration}
            onClearHistory={clearMosfetThermalHistory}
            onReset={resetMosfetThermal}
          />
        ) : feature === "rlc-solver" ? (
          <RlcSolverWorkspace locale={locale} />
        ) : feature === "simetrix-guide" ? (
          <SimetrixGuideWorkspace markdown={simetrixSpeedGuideMarkdown} />
        ) : (
          <VerilogAWorkspace
            activeModel={getVerilogAModel(verilogAModelId)}
            onModelChange={setVerilogAModelId}
          />
        )}
      </main>
    </div>
  );
}

function RlcSolverWorkspace({ locale }: { locale: Locale }) {
  const [frameStatus, setFrameStatus] = useState<"checking" | "ready" | "unavailable">("checking");
  const [probeAttempt, setProbeAttempt] = useState(0);
  const frameSrc = "/rlc-original/?v=workbench-fill-result";

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    setFrameStatus("checking");

    function queueRetry() {
      retryTimer = window.setTimeout(() => {
        setProbeAttempt((current) => current + 1);
      }, 2500);
    }

    fetch(`${frameSrc}&probe=${Date.now()}`, { cache: "no-store" })
      .then(async (response) => {
        const html = await response.text();
        if (cancelled) {
          return;
        }
        if (response.ok && html.includes("RLC Symbolic Solver")) {
          setFrameStatus("ready");
        } else {
          setFrameStatus("unavailable");
          queueRetry();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFrameStatus("unavailable");
          queueRetry();
        }
      });

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [frameSrc, probeAttempt]);

  if (frameStatus !== "ready") {
    return (
      <section className="rlc-original-frame-shell rlc-frame-state" aria-label="Original RLC Symbolic Solver">
        <div className="rlc-frame-message">
          <h2>
            {frameStatus === "checking"
              ? locale === "zh"
                ? "正在載入 RLC 求解器"
                : "Loading RLC solver"
              : locale === "zh"
                ? "RLC 求解器後端尚未連線"
                : "RLC solver backend is not connected"}
          </h2>
          <p>
            {frameStatus === "checking"
              ? locale === "zh"
                ? "正在確認原始 solver 頁面是否可用。"
                : "Checking whether the original solver page is available."
              : locale === "zh"
                ? "請先啟動 FastAPI 後端，或改用整合後端網址開啟 EE Tool。"
                : "Start the FastAPI backend first, or open EE Tool from the integrated backend URL."}
          </p>
          {frameStatus === "unavailable" ? (
            <code>{".\\.venv\\Scripts\\python.exe -m backend.run_api"}</code>
          ) : null}
          {frameStatus === "unavailable" ? (
            <button className="rlc-frame-retry" type="button" onClick={() => setProbeAttempt((current) => current + 1)}>
              {locale === "zh" ? "重新連線" : "Retry connection"}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="rlc-original-frame-shell" aria-label="Original RLC Symbolic Solver">
      <iframe
        className="rlc-original-frame"
        title="Original RLC Symbolic Solver"
        src={frameSrc}
      />
    </section>
  );
}

function SimetrixGuideWorkspace({ markdown }: { markdown: string }) {
  return (
    <section className="simetrix-guide-workspace" aria-label="SIMetrix transient simulation speed guide">
      <article className="simetrix-guide-document">{renderGuideMarkdown(markdown)}</article>
    </section>
  );
}

function renderGuideMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("|") && lines[index + 1]?.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      nodes.push(renderGuideTable(tableLines, nodes.length));
      continue;
    }

    if (line.startsWith("### ")) {
      nodes.push(<h3 key={`guide-${nodes.length}`}>{line.slice(4)}</h3>);
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      nodes.push(<h2 key={`guide-${nodes.length}`}>{line.slice(3)}</h2>);
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      nodes.push(<h1 key={`guide-${nodes.length}`}>{line.slice(2)}</h1>);
      index += 1;
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s/, ""));
        index += 1;
      }
      nodes.push(
        <ol key={`guide-${nodes.length}`}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      nodes.push(
        <ul key={`guide-${nodes.length}`}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("#") &&
      !lines[index].trim().startsWith("|") &&
      !lines[index].trim().startsWith("- ") &&
      !/^\d+\.\s/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    nodes.push(<p key={`guide-${nodes.length}`}>{paragraphLines.join(" ")}</p>);
  }

  return nodes;
}

function renderGuideTable(tableLines: string[], keyIndex: number) {
  const rows = tableLines
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
  const [header, ...body] = rows;

  return (
    <div className="guide-table-scroll" key={`guide-table-${keyIndex}`}>
      <table className="guide-table">
        <thead>
          <tr>
            {header.map((cell) => (
              <th key={cell}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={`${row.join("-")}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VerilogAWorkspace({
  activeModel,
  onModelChange,
}: {
  activeModel: VerilogAModel;
  onModelChange: (modelId: VerilogAModelId) => void;
}) {
  const parameterAssignments = formatVerilogAParameterAssignments(activeModel);

  function downloadModel() {
    const blob = new Blob([activeModel.source], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = activeModel.fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="workspace verilog-workspace">
      <aside className="input-panel verilog-library-panel">
        <div className="panel-heading">
          <h2>模型庫</h2>
        </div>

        <div className="model-library-options" aria-label="Verilog-A model selection">
          {verilogAModels.map((model) => (
            <button
              className={model.id === activeModel.id ? "model-option active" : "model-option"}
              key={model.id}
              type="button"
              onClick={() => onModelChange(model.id)}
            >
              <span>{model.category}</span>
              <strong>{model.title}</strong>
              <small>{model.summary}</small>
            </button>
          ))}
        </div>

        <section className="subpanel">
          <h3>功能行為</h3>
          <ul className="verilog-note-list">
            {activeModel.behavior.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="subpanel">
          <h3>Port 定義</h3>
          <div className="verilog-port-list">
            {activeModel.ports.map((port) => (
              <div className="verilog-port-row" key={port.name}>
                <strong>{port.name}</strong>
                <span>{port.direction}</span>
                <small>{port.description}</small>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <section className="result-panel">
        <div className="summary-strip compact">
          <Metric label="Module" value={activeModel.moduleName} />
          <Metric label="File" value={activeModel.fileName} />
          <Metric label="Parameters" value={`${activeModel.parameters.length}`} />
          <Metric label="Ports" value={`${activeModel.ports.length}`} />
        </div>

        <section className="formula-panel">
          <div className="panel-heading">
            <h2>可調參數</h2>
          </div>
          <div className="verilog-parameter-table">
            <div className="component-row heading verilog-parameter-row">
              <span>參數</span>
              <span>預設值</span>
              <span>用途</span>
            </div>
            {activeModel.parameters.map((parameter) => (
              <div className="component-row verilog-parameter-row" key={parameter.name}>
                <strong>{parameter.name}</strong>
                <span>{parameter.defaultValue}</span>
                <span>{parameter.description}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="formula-panel">
          <div className="panel-heading">
            <h2>SIMetrix 參數貼上文字</h2>
          </div>
          <textarea
            aria-label={`${activeModel.title} SIMetrix parameter assignments`}
            className="parameter-preview"
            readOnly
            value={parameterAssignments}
          />
        </section>

        <section className="formula-panel">
          <div className="panel-heading">
            <h2>Verilog-A 原始碼</h2>
            <button type="button" onClick={downloadModel}>
              <Download aria-hidden="true" size={16} />
              下載 .va
            </button>
          </div>
          <textarea
            aria-label={`${activeModel.title} Verilog-A source`}
            className="script-preview verilog-source"
            readOnly
            value={activeModel.source}
          />
        </section>

        <section className="formula-panel">
          <div className="panel-heading">
            <h2>SIMetrix 使用流程</h2>
          </div>
          <ol className="verilog-use-steps">
            {activeModel.useSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </section>
    </section>
  );
}

function SimetrixWorkspace({
  components,
  selectedReferences,
  modelText,
  netlistText,
  mode,
  netlistFileName,
  createNetlistBeforeRun,
  onFileImport,
  onNetlistTextChange,
  onReferenceToggle,
  onModelTextChange,
  onModeChange,
  onNetlistFileNameChange,
  onCreateNetlistBeforeRunChange,
  onReset,
}: {
  components: SimetrixComponent[];
  selectedReferences: string[];
  modelText: string;
  netlistText: string;
  mode: SimetrixSweepMode;
  netlistFileName: string;
  createNetlistBeforeRun: boolean;
  onFileImport: (file: File | null) => void;
  onNetlistTextChange: (text: string) => void;
  onReferenceToggle: (reference: string) => void;
  onModelTextChange: (text: string) => void;
  onModeChange: (mode: SimetrixSweepMode) => void;
  onNetlistFileNameChange: (value: string) => void;
  onCreateNetlistBeforeRunChange: (value: boolean) => void;
  onReset: () => void;
}) {
  const models = normalizeModelList(modelText);
  const runCount = countSimetrixRuns(selectedReferences.length, models.length, mode);
  const scriptResult = buildSimetrixScriptPreview({
    references: selectedReferences,
    models,
    mode,
    netlistFileName,
    createNetlistBeforeRun,
  });
  function downloadScript() {
    if (!scriptResult.script) {
      return;
    }
    const blob = new Blob([scriptResult.script], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "simetrix_model_sweep.sxscr";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="workspace simetrix-workspace">
      <form className="input-panel simetrix-input">
        <div className="panel-heading">
          <h2>Netlist 與 Sweep 設定</h2>
          <button type="button" onClick={onReset}>
            <RotateCcw aria-hidden="true" size={16} />
            重設
          </button>
        </div>

        <div className="subpanel">
          <h3>SIMetrix netlist 匯入</h3>
          <p>支援 SIMetrix/SPICE 文字 netlist；工具會偵測 Q、M、S、X 開頭的候選開關 instance。</p>
          <input
            className="file-input"
            type="file"
            accept=".net,.cir,.txt,.sp,.sph"
            onChange={(event) => onFileImport(event.target.files?.[0] ?? null)}
          />
          <textarea
            aria-label="SIMetrix netlist text"
            placeholder="貼上或匯入 SIMetrix netlist..."
            value={netlistText}
            onChange={(event) => onNetlistTextChange(event.target.value)}
          />
        </div>

        <div className="subpanel">
          <h3>Model 清單</h3>
          <p>每行或用逗號分隔一個 model，例如 IGC033S101_L1、IGC025S08S1_L1。</p>
          <textarea
            aria-label="SIMetrix model list"
            value={modelText}
            onChange={(event) => onModelTextChange(event.target.value)}
          />
        </div>

        <label className="select-field">
          <span>Sweep 模式</span>
          <select value={mode} onChange={(event) => onModeChange(event.target.value as SimetrixSweepMode)}>
            <option value="same-model">同組替換：所有選取開關使用同一個 model</option>
            <option value="all-combinations">完整組合：每個開關各自排列所有 model</option>
          </select>
        </label>

        <label className="select-field">
          <span>Netlist 檔名</span>
          <input
            value={netlistFileName}
            onChange={(event) => onNetlistFileNameChange(event.target.value)}
          />
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={createNetlistBeforeRun}
            onChange={(event) => onCreateNetlistBeforeRunChange(event.target.checked)}
          />
          <span>每次模擬前加入 Netlist 指令</span>
        </label>

      </form>

      <section className="result-panel">
        <div className="summary-strip compact">
          <Metric label="候選開關" value={`${components.length}`} />
          <Metric label="已選開關" value={`${selectedReferences.length}`} />
          <Metric label="Model 數量" value={`${models.length}`} />
          <Metric label="模擬次數" value={`${runCount}`} />
        </div>

        <section className="formula-panel">
          <div className="panel-heading">
            <h2>偵測到的開關元件</h2>
          </div>
          {components.length > 0 ? (
            <div className="simetrix-component-table">
              <div className="component-row heading">
                <span>使用</span>
                <span>Ref / 類型</span>
                <span>原始 model</span>
              </div>
              {components.map((component) => (
                <label key={component.reference} className="component-row simetrix-component-row">
                  <span>
                    <input
                      type="checkbox"
                      checked={selectedReferences.includes(component.reference)}
                      onChange={() => onReferenceToggle(component.reference)}
                    />
                  </span>
                  <strong>
                    {component.reference}
                    <small>{labelSimetrixKind(component.kind)}，line {component.lineNumber}</small>
                  </strong>
                  <span>{component.model ?? "N/A"}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="message info">尚未偵測到 Q/M/S/X 開關候選元件。</p>
          )}
        </section>

        <section className="formula-panel">
          <div className="panel-heading">
            <h2>產生的 .sxscr 腳本</h2>
            <button type="button" onClick={downloadScript} disabled={!scriptResult.script}>
              <Download aria-hidden="true" size={16} />
              下載
            </button>
          </div>
          {scriptResult.error && <p className="message warning">{scriptResult.error}</p>}
          <textarea
            className="script-preview"
            readOnly
            value={scriptResult.script}
            aria-label="Generated SIMetrix script"
          />
        </section>

      </section>
    </section>
  );
}

function buildSimetrixScriptPreview(options: SimetrixScriptOptions): { script: string; error: string | null } {
  try {
    return {
      script: generateSimetrixSweepScript(options),
      error: null,
    };
  } catch (error) {
    return {
      script: "",
      error: error instanceof Error ? error.message : "Unable to generate SIMetrix script.",
    };
  }
}

function labelSimetrixKind(kind: SimetrixComponent["kind"]): string {
  if (kind === "bjt_igbt") {
    return "Q / BJT 或 IGBT";
  }
  if (kind === "mosfet") {
    return "M / MOSFET";
  }
  if (kind === "switch") {
    return "S / Switch";
  }
  return "X / Subcircuit";
}

function MosfetThermalWorkspace({
  locale,
  inputs,
  switchRows,
  condition,
  history,
  onInputChange,
  onSwitchChange,
  onAddSwitch,
  onRemoveSwitch,
  onConditionChange,
  onRecord,
  onClearHistory,
  onReset,
}: {
  locale: Locale;
  inputs: MosfetThermalInputs;
  switchRows: MosfetThermalSwitchInput[];
  condition: MosfetThermalConditionInputs;
  history: MosfetThermalIterationRow[];
  onInputChange: (key: keyof MosfetThermalInputs, value: number) => void;
  onSwitchChange: <K extends keyof MosfetThermalSwitchInput>(
    id: number,
    key: K,
    value: MosfetThermalSwitchInput[K],
  ) => void;
  onAddSwitch: () => void;
  onRemoveSwitch: (id: number) => void;
  onConditionChange: <K extends keyof MosfetThermalConditionInputs>(
    key: K,
    value: MosfetThermalConditionInputs[K],
  ) => void;
  onRecord: () => void;
  onClearHistory: () => void;
  onReset: () => void;
}) {
  const switchResults = switchRows.map((row) => ({
    input: row,
    result: calculateMosfetThermalIteration(buildSwitchThermalInputs(row, inputs)),
  }));
  const validSwitchResults = switchResults.filter((row) => row.result.status !== "invalid");
  const globalNextSimulationTemperatureC =
    validSwitchResults.length > 0
      ? Math.max(...validSwitchResults.map((row) => row.result.nextSimulationTemperatureC))
      : Number.NaN;
  const hottestSwitch = validSwitchResults.reduce<MosfetThermalRecordedSwitchRow | null>(
    (current, row) =>
      !current || row.result.estimatedJunctionTemperatureC > current.result.estimatedJunctionTemperatureC
        ? row
        : current,
    null,
  );
  const minimumMarginC =
    validSwitchResults.length > 0 ? Math.min(...validSwitchResults.map((row) => row.result.marginC)) : Number.NaN;
  const text = mosfetThermalText[locale];
  const outputCurrentA = condition.outputVoltageV > 0 ? condition.outputPowerW / condition.outputVoltageV : Number.NaN;

  return (
    <section className="workspace mosfet-thermal-workspace">
      <form className="input-panel mosfet-thermal-input">
        <div className="panel-heading">
          <h2>{text.inputsTitle}</h2>
          <button type="button" onClick={onReset}>
            <RotateCcw aria-hidden="true" size={16} />
            {translations[locale].reset}
          </button>
        </div>

        <div className="subpanel thermal-condition-panel">
          <h3>{text.conditionTitle}</h3>
          <ThermalTextField
            label={text.caseName}
            value={condition.caseName}
            onChange={(value) => onConditionChange("caseName", value)}
          />
          <div className="thermal-field-grid">
            <ThermalNumberField
              label={text.inputVoltage}
              suffix="V"
              value={condition.inputVoltageV}
              onChange={(value) => onConditionChange("inputVoltageV", value)}
            />
            <ThermalNumberField
              label={text.outputVoltage}
              suffix="V"
              value={condition.outputVoltageV}
              onChange={(value) => onConditionChange("outputVoltageV", value)}
            />
            <ThermalNumberField
              label={text.outputPower}
              suffix="W"
              value={condition.outputPowerW}
              onChange={(value) => onConditionChange("outputPowerW", value)}
            />
          </div>
          <div className="thermal-condition-readout">
            <span>{text.outputCurrent}</span>
            <strong>{formatThermalValue(outputCurrentA, "A")}</strong>
          </div>
        </div>

        <div className="thermal-field-grid">
          <ThermalNumberField
            label={text.ambientTemperature}
            suffix="degC"
            value={inputs.ambientTemperatureC}
            onChange={(value) => onInputChange("ambientTemperatureC", value)}
          />
          <ThermalNumberField
            label={text.simulationTemperature}
            suffix="degC"
            value={inputs.simulationTemperatureC}
            onChange={(value) => onInputChange("simulationTemperatureC", value)}
          />
          <ThermalNumberField
            label={text.rthJunctionCase}
            suffix="K/W"
            value={inputs.rthJunctionCase}
            onChange={(value) => onInputChange("rthJunctionCase", value)}
          />
          <ThermalNumberField
            label={text.rthCaseAmbient}
            suffix="K/W"
            value={inputs.rthCaseAmbient}
            onChange={(value) => onInputChange("rthCaseAmbient", value)}
          />
          <ThermalNumberField
            label={text.maxJunctionTemperature}
            suffix="degC"
            value={inputs.maxJunctionTemperatureC}
            onChange={(value) => onInputChange("maxJunctionTemperatureC", value)}
          />
          <ThermalNumberField
            label={text.relaxationFactor}
            suffix="x"
            value={inputs.relaxationFactor}
            step={0.1}
            onChange={(value) => onInputChange("relaxationFactor", value)}
          />
          <ThermalNumberField
            label={text.tolerance}
            suffix="degC"
            value={inputs.toleranceC}
            onChange={(value) => onInputChange("toleranceC", value)}
          />
        </div>

        <section className="subpanel thermal-switch-input-panel">
          <div className="panel-heading">
            <h3>{text.switchListTitle}</h3>
            <button type="button" onClick={onAddSwitch}>
              {text.addSwitch}
            </button>
          </div>
          <div className="thermal-switch-list">
            {switchRows.map((row) => (
              <div className="thermal-switch-editor" key={row.id}>
                <div className="thermal-switch-editor-heading">
                  <strong>{row.reference || text.unnamedSwitch}</strong>
                  <button type="button" onClick={() => onRemoveSwitch(row.id)} disabled={switchRows.length <= 1}>
                    {text.removeSwitch}
                  </button>
                </div>
                <ThermalTextField
                  label={text.switchRef}
                  value={row.reference}
                  onChange={(value) => onSwitchChange(row.id, "reference", value)}
                />
                <ThermalTextField
                  label={text.switchRole}
                  value={row.role}
                  onChange={(value) => onSwitchChange(row.id, "role", value)}
                />
                <ThermalNumberField
                  label={text.switchPowerLoss}
                  suffix="W"
                  value={row.powerLossW}
                  onChange={(value) => onSwitchChange(row.id, "powerLossW", value)}
                />
                <ThermalNumberField
                  label={text.switchRthJc}
                  suffix="K/W"
                  value={row.rthJunctionCase}
                  onChange={(value) => onSwitchChange(row.id, "rthJunctionCase", value)}
                />
                <ThermalNumberField
                  label={text.switchRthCa}
                  suffix="K/W"
                  value={row.rthCaseAmbient}
                  onChange={(value) => onSwitchChange(row.id, "rthCaseAmbient", value)}
                />
                <ThermalNumberField
                  label={text.switchTjMax}
                  suffix="degC"
                  value={row.maxJunctionTemperatureC}
                  onChange={(value) => onSwitchChange(row.id, "maxJunctionTemperatureC", value)}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="analysis-actions">
          <button className="run-analysis" type="button" onClick={onRecord}>
            <Play aria-hidden="true" size={17} />
            {text.recordButton}
          </button>
        </div>
      </form>

      <section className="result-panel">
        <div className="summary-strip thermal-summary">
          <Metric label={text.switchCount} value={`${switchRows.length}`} />
          <Metric label={text.hottestSwitch} value={hottestSwitch?.input.reference ?? "N/A"} />
          <Metric label={text.globalNextTemperature} value={formatThermalValue(globalNextSimulationTemperatureC, "degC")} />
          <Metric label={text.minMargin} value={formatSignedThermalValue(minimumMarginC, "degC")} />
        </div>

        <ThermalGlobalStatusPanel locale={locale} rows={switchResults} />

        <section className="formula-panel thermal-next-panel">
          <div className="panel-heading">
            <h2>{text.nextTitle}</h2>
          </div>
          <div className="next-temperature">
            <span>{text.nextTemperature}</span>
            <strong>{formatThermalValue(globalNextSimulationTemperatureC, "degC")}</strong>
          </div>
          <div className="thermal-equation-grid">
            <code>Tj = Tamb + Ploss x (Rth_jc + Rth_ca)</code>
            <code>Tnext = Tsim + alpha x (Tj - Tsim)</code>
          </div>
        </section>

        <section className="formula-panel">
          <div className="panel-heading">
            <h2>{text.checkTitle}</h2>
          </div>
          <div className="thermal-check-list">
            <ThermalCheck label={text.lossInput} value={formatThermalValue(sumSwitchLoss(switchRows), "W")} />
            <ThermalCheck
              label={text.distanceToConvergence}
              value={formatThermalValue(maxSwitchAbsError(switchResults), "degC")}
            />
            <ThermalCheck
              label={text.distanceToLimit}
              value={formatSignedThermalValue(minimumMarginC, "degC")}
            />
          </div>
        </section>

        <section className="formula-panel thermal-history-panel">
          <div className="panel-heading">
            <h2>{text.currentSwitchResultsTitle}</h2>
          </div>
          <div className="thermal-table-scroll">
            <table className="thermal-iteration-table switch-detail-table">
              <thead>
                <tr>
                  <th>{text.switchRef}</th>
                  <th>{text.switchRole}</th>
                  <th>Tsim</th>
                  <th>Pavg</th>
                  <th>Rth total</th>
                  <th>Tj_raw</th>
                  <th>Tsim_next</th>
                  <th>Margin</th>
                  <th>{text.statusColumn}</th>
                </tr>
              </thead>
              <tbody>
                {switchResults.map((row) => (
                  <tr key={row.input.id}>
                    <td>{row.input.reference || "-"}</td>
                    <td>{row.input.role || "-"}</td>
                    <td>{formatThermalValue(inputs.simulationTemperatureC, "degC")}</td>
                    <td>{formatThermalValue(row.input.powerLossW, "W")}</td>
                    <td>{formatThermalValue(row.result.rthTotal, "K/W")}</td>
                    <td>{formatThermalValue(row.result.estimatedJunctionTemperatureC, "degC")}</td>
                    <td>{formatThermalValue(row.result.nextSimulationTemperatureC, "degC")}</td>
                    <td>{formatSignedThermalValue(row.result.marginC, "degC")}</td>
                    <td>{text.statusLabels[row.result.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="formula-panel thermal-history-panel">
          <div className="panel-heading">
            <h2>{text.historyTitle}</h2>
            <button type="button" onClick={onClearHistory} disabled={history.length === 0}>
              <RotateCcw aria-hidden="true" size={16} />
              {text.clearHistory}
            </button>
          </div>
          {history.length > 0 ? (
            <div className="thermal-table-scroll">
              <table className="thermal-iteration-table">
                <thead>
                  <tr>
                    <th>Iter</th>
                    <th>{text.caseColumn}</th>
                    <th>Vin</th>
                    <th>Vout</th>
                    <th>Pout</th>
                    <th>Iout</th>
                    <th>{text.hottestSwitch}</th>
                    <th>{text.globalNextTemperature}</th>
                    <th>{text.minMargin}</th>
                    <th>{text.statusColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, index) => (
                    <tr key={`${row.id}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{row.condition.caseName || "-"}</td>
                      <td>{formatThermalValue(row.condition.inputVoltageV, "V")}</td>
                      <td>{formatThermalValue(row.condition.outputVoltageV, "V")}</td>
                      <td>{formatThermalValue(row.condition.outputPowerW, "W")}</td>
                      <td>{formatThermalValue(calculateConditionOutputCurrent(row.condition), "A")}</td>
                      <td>{row.hottestSwitchRef}</td>
                      <td>{formatThermalValue(row.globalNextSimulationTemperatureC, "degC")}</td>
                      <td>{formatSignedThermalValue(row.minimumMarginC, "degC")}</td>
                      <td>{summarizeRecordedSwitchStatus(row, text.statusLabels)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="message info">{text.emptyHistory}</p>
          )}
        </section>

        {history.length > 0 && (
          <section className="formula-panel thermal-history-panel">
            <div className="panel-heading">
              <h2>{text.switchDetailTitle}</h2>
            </div>
            <div className="thermal-table-scroll">
              <table className="thermal-iteration-table switch-detail-table">
                <thead>
                  <tr>
                    <th>Iter</th>
                    <th>{text.switchRef}</th>
                    <th>{text.switchRole}</th>
                    <th>Tsim</th>
                    <th>Pavg</th>
                    <th>Rth total</th>
                    <th>Tj_raw</th>
                    <th>Tsim_next</th>
                    <th>Margin</th>
                    <th>{text.statusColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.flatMap((row, index) =>
                    row.switchRows.map((switchRow) => (
                      <tr key={`${row.id}-${switchRow.input.id}`}>
                        <td>{index + 1}</td>
                        <td>{switchRow.input.reference || "-"}</td>
                        <td>{switchRow.input.role || "-"}</td>
                        <td>{formatThermalValue(switchRow.input.simulationTemperatureC, "degC")}</td>
                        <td>{formatThermalValue(switchRow.input.powerLossW, "W")}</td>
                        <td>{formatThermalValue(switchRow.result.rthTotal, "K/W")}</td>
                        <td>{formatThermalValue(switchRow.result.estimatedJunctionTemperatureC, "degC")}</td>
                        <td>{formatThermalValue(switchRow.result.nextSimulationTemperatureC, "degC")}</td>
                        <td>{formatSignedThermalValue(switchRow.result.marginC, "degC")}</td>
                        <td>{text.statusLabels[switchRow.result.status]}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </section>
  );
}

function ThermalNumberField({
  label,
  suffix,
  value,
  step = 0.1,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="thermal-number-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <small>{suffix}</small>
      </div>
    </label>
  );
}

function ThermalTextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="thermal-text-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ThermalGlobalStatusPanel({
  locale,
  rows,
}: {
  locale: Locale;
  rows: MosfetThermalRecordedSwitchRow[];
}) {
  const text = mosfetThermalText[locale];
  const hasInvalid = rows.some((row) => row.result.status === "invalid");
  const hasOverLimit = rows.some((row) => row.result.status === "over-limit");
  const allConverged = rows.length > 0 && rows.every((row) => row.result.status === "converged");
  const nearOnly = rows.length > 0 && rows.every((row) => row.result.status === "converged" || row.result.status === "near");
  const statusClass = hasInvalid || hasOverLimit ? "danger" : allConverged ? "ok" : "warning";
  const heading = hasInvalid
    ? text.globalStatusInvalid
    : hasOverLimit
      ? text.globalStatusOverLimit
      : allConverged
        ? text.globalStatusConverged
        : nearOnly
          ? text.globalStatusNear
          : text.globalStatusIterate;
  const message = hasInvalid
    ? text.globalMessageInvalid
    : hasOverLimit
      ? text.globalMessageOverLimit
      : allConverged
        ? text.globalMessageConverged
        : text.globalMessageIterate;

  return (
    <section className={`status ${statusClass}`}>
      <strong>{heading}</strong>
      <ul>
        <li>{message}</li>
      </ul>
    </section>
  );
}

function ThermalCheck({ label, value }: { label: string; value: string }) {
  return (
    <div className="thermal-check">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const mosfetThermalText = {
  zh: {
    inputsTitle: "本輪 L1 模擬資料",
    conditionTitle: "操作條件紀錄",
    caseName: "條件名稱",
    inputVoltage: "輸入電壓 Vin",
    outputVoltage: "輸出電壓 Vout",
    outputPower: "輸出功率 Pout",
    outputCurrent: "換算輸出電流 Iout",
    switchListTitle: "開關損耗清單",
    addSwitch: "新增開關",
    removeSwitch: "移除",
    unnamedSwitch: "未命名開關",
    switchRef: "開關 Ref",
    switchRole: "角色",
    switchPowerLoss: "量測平均損耗 Pavg",
    switchRthJc: "Rth junction-to-case",
    switchRthCa: "Rth case-to-ambient",
    switchTjMax: "Tj 上限",
    switchCount: "開關數",
    hottestSwitch: "最熱開關",
    globalNextTemperature: "下一輪 global Tsim",
    minMargin: "最小 margin",
    currentSwitchResultsTitle: "本輪各開關結果",
    switchDetailTitle: "歷史開關明細",
    ambientTemperature: "環境溫度 Tamb",
    simulationTemperature: "SIMetrix 設定溫度 Tsim",
    rthJunctionCase: "Rth junction-to-case",
    rthCaseAmbient: "Rth case-to-ambient",
    maxJunctionTemperature: "Tj 上限",
    relaxationFactor: "建議步進係數 alpha",
    tolerance: "收斂容許誤差",
    errorMetric: "Tj - Tsim",
    marginMetric: "Tj margin",
    nextTitle: "下一輪建議",
    nextTemperature: "請在下一輪 L1 模擬嘗試",
    checkTitle: "距離目標",
    lossInput: "本輪總開關損耗",
    distanceToConvergence: "距離收斂目標",
    distanceToLimit: "距離 Tj 上限",
    recordButton: "加入本輪計算",
    historyTitle: "迭代紀錄",
    clearHistory: "清除紀錄",
    emptyHistory: "按下加入本輪計算後，這裡會保留每次 L1 損耗迭代結果。",
    caseColumn: "條件",
    statusColumn: "狀態",
    globalStatusInvalid: "輸入需要修正",
    globalStatusOverLimit: "有開關超過 Tj 上限",
    globalStatusConverged: "所有開關已收斂",
    globalStatusNear: "接近收斂",
    globalStatusIterate: "需要下一輪",
    globalMessageInvalid: "請先修正開關清單中的無效數值。",
    globalMessageOverLimit: "至少一顆開關的估算 Tj 已超過上限；接受此工作點前，需要降低損耗或改善散熱。",
    globalMessageConverged: "所有開關都已在容許誤差內；可將本輪 Tj 視為 L1 穩態估算。",
    globalMessageIterate: "策略 A 使用最熱開關的建議值；下一輪 SIMetrix global 溫度請設為上方數值。",
    statusLabels: {
      converged: "已收斂",
      near: "接近收斂",
      iterate: "需要下一輪",
      "over-limit": "超過 Tj 上限",
      invalid: "輸入需要修正",
    },
  },
  en: {
    inputsTitle: "Current L1 Run Data",
    conditionTitle: "Operating Condition",
    caseName: "Case name",
    inputVoltage: "Input voltage Vin",
    outputVoltage: "Output voltage Vout",
    outputPower: "Output power Pout",
    outputCurrent: "Calculated output current Iout",
    switchListTitle: "Switch Loss List",
    addSwitch: "Add switch",
    removeSwitch: "Remove",
    unnamedSwitch: "Unnamed switch",
    switchRef: "Switch ref",
    switchRole: "Role",
    switchPowerLoss: "Measured average loss Pavg",
    switchRthJc: "Rth junction-to-case",
    switchRthCa: "Rth case-to-ambient",
    switchTjMax: "Tj limit",
    switchCount: "Switch count",
    hottestSwitch: "Hottest switch",
    globalNextTemperature: "Next global Tsim",
    minMargin: "Minimum margin",
    currentSwitchResultsTitle: "Current Switch Results",
    switchDetailTitle: "History Switch Details",
    ambientTemperature: "Ambient temperature Tamb",
    simulationTemperature: "SIMetrix temperature Tsim",
    rthJunctionCase: "Rth junction-to-case",
    rthCaseAmbient: "Rth case-to-ambient",
    maxJunctionTemperature: "Tj limit",
    relaxationFactor: "Suggestion factor alpha",
    tolerance: "Convergence tolerance",
    errorMetric: "Tj - Tsim",
    marginMetric: "Tj margin",
    nextTitle: "Next Suggestion",
    nextTemperature: "Try this temperature in the next L1 run",
    checkTitle: "Distance To Target",
    lossInput: "Total switch loss",
    distanceToConvergence: "Distance to convergence",
    distanceToLimit: "Distance to Tj limit",
    recordButton: "Add iteration",
    historyTitle: "Iteration History",
    clearHistory: "Clear history",
    emptyHistory: "After adding an iteration, each L1 loss calculation will be kept here.",
    caseColumn: "Case",
    statusColumn: "Status",
    globalStatusInvalid: "Fix inputs",
    globalStatusOverLimit: "A switch is over Tj limit",
    globalStatusConverged: "All switches converged",
    globalStatusNear: "Nearly converged",
    globalStatusIterate: "Next run needed",
    globalMessageInvalid: "Fix invalid values in the switch list first.",
    globalMessageOverLimit: "At least one switch exceeds its Tj limit. Reduce loss or improve cooling before accepting this operating point.",
    globalMessageConverged: "Every switch is within the convergence tolerance; this is a steady-state L1 Tj estimate.",
    globalMessageIterate: "Strategy A uses the hottest switch suggestion. Set the next SIMetrix global temperature to the value above.",
    statusLabels: {
      converged: "Converged",
      near: "Nearly converged",
      iterate: "Next run needed",
      "over-limit": "Over Tj limit",
      invalid: "Fix inputs",
    },
  },
} satisfies Record<Locale, {
  inputsTitle: string;
  conditionTitle: string;
  caseName: string;
  inputVoltage: string;
  outputVoltage: string;
  outputPower: string;
  outputCurrent: string;
  switchListTitle: string;
  addSwitch: string;
  removeSwitch: string;
  unnamedSwitch: string;
  switchRef: string;
  switchRole: string;
  switchPowerLoss: string;
  switchRthJc: string;
  switchRthCa: string;
  switchTjMax: string;
  switchCount: string;
  hottestSwitch: string;
  globalNextTemperature: string;
  minMargin: string;
  currentSwitchResultsTitle: string;
  switchDetailTitle: string;
  ambientTemperature: string;
  simulationTemperature: string;
  rthJunctionCase: string;
  rthCaseAmbient: string;
  maxJunctionTemperature: string;
  relaxationFactor: string;
  tolerance: string;
  errorMetric: string;
  marginMetric: string;
  nextTitle: string;
  nextTemperature: string;
  checkTitle: string;
  lossInput: string;
  distanceToConvergence: string;
  distanceToLimit: string;
  recordButton: string;
  historyTitle: string;
  clearHistory: string;
  emptyHistory: string;
  caseColumn: string;
  statusColumn: string;
  globalStatusInvalid: string;
  globalStatusOverLimit: string;
  globalStatusConverged: string;
  globalStatusNear: string;
  globalStatusIterate: string;
  globalMessageInvalid: string;
  globalMessageOverLimit: string;
  globalMessageConverged: string;
  globalMessageIterate: string;
  statusLabels: Record<MosfetThermalResult["status"], string>;
}>;

function formatThermalValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  return `${Number(value.toFixed(2))} ${unit}`;
}

function formatSignedThermalValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number(value.toFixed(2))} ${unit}`;
}

function buildSwitchThermalInputs(
  row: MosfetThermalSwitchInput,
  sharedInputs: MosfetThermalInputs,
): MosfetThermalInputs {
  return {
    ambientTemperatureC: sharedInputs.ambientTemperatureC,
    simulationTemperatureC: sharedInputs.simulationTemperatureC,
    powerLossW: row.powerLossW,
    rthJunctionCase: row.rthJunctionCase,
    rthCaseAmbient: row.rthCaseAmbient,
    maxJunctionTemperatureC: row.maxJunctionTemperatureC,
    relaxationFactor: sharedInputs.relaxationFactor,
    toleranceC: sharedInputs.toleranceC,
  };
}

function maxSwitchAbsError(rows: MosfetThermalRecordedSwitchRow[]): number {
  const values = rows
    .map((row) => row.result.absErrorC)
    .filter((value) => Number.isFinite(value));
  return values.length > 0 ? Math.max(...values) : Number.NaN;
}

function sumSwitchLoss(rows: MosfetThermalSwitchInput[]): number {
  return rows.reduce((sum, row) => sum + (Number.isFinite(row.powerLossW) ? row.powerLossW : 0), 0);
}

function summarizeRecordedSwitchStatus(
  row: MosfetThermalIterationRow,
  labels: Record<MosfetThermalResult["status"], string>,
): string {
  const statuses = row.switchRows.map((switchRow) => switchRow.result.status);
  if (statuses.includes("invalid")) {
    return labels.invalid;
  }
  if (statuses.includes("over-limit")) {
    return labels["over-limit"];
  }
  if (statuses.every((status) => status === "converged")) {
    return labels.converged;
  }
  if (statuses.every((status) => status === "converged" || status === "near")) {
    return labels.near;
  }
  return labels.iterate;
}

function calculateConditionOutputCurrent(condition: MosfetThermalConditionInputs): number {
  return condition.outputVoltageV > 0 ? condition.outputPowerW / condition.outputVoltageV : Number.NaN;
}

function BootstrapWorkspace({
  locale,
  method,
  values,
  units,
  analysis,
  analysisDirty,
  onMethodChange,
  onValueChange,
  onUnitChange,
  onReset,
  onRun,
}: {
  locale: Locale;
  method: MethodId;
  values: NumericState;
  units: UnitState;
  analysis: CalculationResult | null;
  analysisDirty: boolean;
  onMethodChange: (method: MethodId) => void;
  onValueChange: (key: string, value: number) => void;
  onUnitChange: (key: string, value: string) => void;
  onReset: () => void;
  onRun: () => void;
}) {
  const t = translations[locale];
  return (
    <>
      <section className="method-tabs" aria-label="Calculation method">
        {(Object.keys(methodLabels) as MethodId[]).map((id) => (
          <button
            key={id}
            className={id === method ? "active" : ""}
            type="button"
            onClick={() => onMethodChange(id)}
          >
            {methodLabels[id]}
          </button>
        ))}
      </section>

      <section className="workspace">
        <form className="input-panel">
          <div className="panel-heading">
            <h2>{methodLabels[method]}</h2>
            <button type="button" onClick={onReset}>
              <RotateCcw aria-hidden="true" size={16} />
              {t.reset}
            </button>
          </div>
          {method === "ti" && (
            <TiFields
              locale={locale}
              values={values}
              units={units}
              onChange={onValueChange}
              onUnitChange={onUnitChange}
            />
          )}
          {method === "onsemi" && (
            <OnsemiFields
              locale={locale}
              values={values}
              units={units}
              onChange={onValueChange}
              onUnitChange={onUnitChange}
            />
          )}
          {method === "infineon" && (
            <InfineonFields
              locale={locale}
              values={values}
              units={units}
              onChange={onValueChange}
              onUnitChange={onUnitChange}
            />
          )}
          <div className="analysis-actions">
            <button className="run-analysis" type="button" onClick={onRun}>
              <Play aria-hidden="true" size={18} />
              {t.runAnalysis}
            </button>
          </div>
        </form>

        {analysis ? (
          <ResultPanel result={analysis} locale={locale} dirty={analysisDirty} />
        ) : (
          <PendingPanel locale={locale} />
        )}
        <ReferencePanel locale={locale} />
      </section>
    </>
  );
}

function CompensatorWorkspace({
  locale,
  compensatorType,
  compensatorMode,
  values,
  units,
  csvText,
  bodePoints,
  csvMessages,
  analysis,
  analysisDirty,
  onCompensatorTypeChange,
  onCompensatorModeChange,
  onValueChange,
  onUnitChange,
  onCsvChange,
  onFileImport,
  onReset,
  onRun,
}: {
  locale: Locale;
  compensatorType: CompensatorType;
  compensatorMode: CompensatorDesignMode;
  values: NumericState;
  units: UnitState;
  csvText: string;
  bodePoints: BodePoint[];
  csvMessages: Message[];
  analysis: CompensatorResult | null;
  analysisDirty: boolean;
  onCompensatorTypeChange: (type: CompensatorType) => void;
  onCompensatorModeChange: (mode: CompensatorDesignMode) => void;
  onValueChange: (key: string, value: number) => void;
  onUnitChange: (key: string, value: string) => void;
  onCsvChange: (text: string) => void;
  onFileImport: (file: File | null) => void;
  onReset: () => void;
  onRun: () => void;
}) {
  const t = translations[locale];
  const hasDangerCsv = csvMessages.some((message) => message.severity === "danger");
  return (
    <>
      <section className="method-tabs" aria-label="Compensator type">
        {(Object.keys(compensatorTypeLabels) as CompensatorType[]).map((id) => (
          <button
            key={id}
            className={id === compensatorType ? "active" : ""}
            type="button"
            onClick={() => onCompensatorTypeChange(id)}
          >
            {compensatorTypeLabels[id]}
          </button>
        ))}
      </section>

      <section className="method-tabs" aria-label="Compensator design mode">
        {(Object.keys(compensatorModeLabels) as CompensatorDesignMode[]).map((id) => (
          <button
            key={id}
            className={id === compensatorMode ? "active" : ""}
            type="button"
            onClick={() => onCompensatorModeChange(id)}
          >
            {compensatorModeLabels[id]}
          </button>
        ))}
      </section>

      <section className="workspace compensator-workspace">
        <form className="input-panel compensator-input">
          <div className="panel-heading">
            <h2>{compensatorTypeLabels[compensatorType]}</h2>
            <button type="button" onClick={onReset}>
              <RotateCcw aria-hidden="true" size={16} />
              {t.reset}
            </button>
          </div>

          <section className="subpanel">
            <h3>
              <FileText aria-hidden="true" size={16} />
              {t.csvInput}
            </h3>
            <p>{t.csvHelp}</p>
            <input
              className="file-input"
              aria-label="Bode CSV file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => onFileImport(event.target.files?.[0] ?? null)}
            />
            <textarea
              aria-label="Bode CSV text"
              value={csvText}
              onChange={(event) => onCsvChange(event.target.value)}
              rows={8}
            />
            <CsvSummary locale={locale} points={bodePoints} messages={csvMessages} />
          </section>

          <section className="subpanel">
            <h3>{t.targetSettings}</h3>
            <div className="field-grid">
              <NumberField fieldKey="crossoverFrequency" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
              {compensatorMode === "auto" && compensatorType !== "type1" && (
                <NumberField fieldKey="targetPhaseMargin" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
              )}
              <NumberField fieldKey="r1" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
              {compensatorMode === "manual" && compensatorType === "type1" && (
                <NumberField fieldKey="originPoleFrequency" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
              )}
              {compensatorMode === "manual" && compensatorType === "type2" && (
                <>
                  <NumberField fieldKey="zeroFrequency" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
                  <NumberField fieldKey="poleFrequency" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
                </>
              )}
              {compensatorMode === "manual" && compensatorType === "type3" && (
                <>
                  <NumberField fieldKey="zeroFrequency1" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
                  <NumberField fieldKey="zeroFrequency2" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
                  <NumberField fieldKey="poleFrequency1" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
                  <NumberField fieldKey="poleFrequency2" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
                </>
              )}
              {compensatorType === "type3" && (
                <>
                  <NumberField fieldKey="resonantFrequency" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
                  <NumberField fieldKey="switchingFrequency" locale={locale} values={values} units={units} onChange={onValueChange} onUnitChange={onUnitChange} />
                </>
              )}
            </div>
          </section>

          <div className="analysis-actions">
            <button
              className="run-analysis"
              type="button"
              onClick={onRun}
              disabled={hasDangerCsv || bodePoints.length < 2}
            >
              <Play aria-hidden="true" size={18} />
              {t.runAnalysis}
            </button>
          </div>
        </form>

        {analysis ? (
          <CompensatorResultPanel
            result={analysis}
            locale={locale}
            dirty={analysisDirty}
          />
        ) : (
          <PendingPanel locale={locale} />
        )}
      </section>
    </>
  );
}

function DigitalControllerWorkspace({
  locale,
  analogResult,
  analogDirty,
  values,
  units,
  pwmCarrier,
  onPwmCarrierChange,
  onValueChange,
  onUnitChange,
  onOpenAnalog,
}: {
  locale: Locale;
  analogResult: CompensatorResult | null;
  analogDirty: boolean;
  values: NumericState;
  units: UnitState;
  pwmCarrier: PwmCarrierMode;
  onPwmCarrierChange: (carrier: PwmCarrierMode) => void;
  onValueChange: (key: string, value: number) => void;
  onUnitChange: (key: string, value: string) => void;
  onOpenAnalog: () => void;
}) {
  const isZh = locale === "zh";
  const [draftValues, setDraftValues] = useState<NumericState>(values);
  const [draftUnits, setDraftUnits] = useState<UnitState>(units);
  const [draftPwmCarrier, setDraftPwmCarrier] = useState<PwmCarrierMode>(pwmCarrier);
  const [digitalRevision, setDigitalRevision] = useState(0);
  const [digitalDirty, setDigitalDirty] = useState(false);
  const digitalResult = useMemo(
    () =>
      analogResult
        ? calculateDigitalCompensator({
          analogResult,
          samplingFrequency: toSi(draftValues.samplingFrequency, draftUnits.samplingFrequency),
          pwmFrequency: toSi(draftValues.pwmFrequency, draftUnits.pwmFrequency),
          pwmUpdateCycles: toSi(draftValues.pwmUpdateCycles, draftUnits.pwmUpdateCycles),
          dutyMin: toSi(draftValues.dutyMin, draftUnits.dutyMin),
          dutyMax: toSi(draftValues.dutyMax, draftUnits.dutyMax),
          initialDuty: toSi(draftValues.initialDuty, draftUnits.initialDuty),
          computationDelaySamples: toSi(draftValues.computationDelaySamples, draftUnits.computationDelaySamples),
          outputDelaySamples: toSi(draftValues.outputDelaySamples, draftUnits.outputDelaySamples),
          pwmCarrier: draftPwmCarrier,
          adcBits: toSi(draftValues.adcBits, draftUnits.adcBits),
          dpwmBits: toSi(draftValues.dpwmBits, draftUnits.dpwmBits),
          method: "tustin",
        })
        : null,
    [analogResult, digitalRevision],
  );

  useEffect(() => {
    setDigitalDirty(false);
    setDraftValues(values);
    setDraftUnits(units);
    setDraftPwmCarrier(pwmCarrier);
  }, [analogResult]);

  function handleValueChange(key: string, value: number) {
    setDraftValues((current) => ({ ...current, [key]: value }));
    setDigitalDirty(true);
  }

  function handleUnitChange(key: string, value: string) {
    const siValue = toSi(draftValues[key], draftUnits[key]);
    const nextValue = fromSi(siValue, value);
    setDraftUnits((current) => ({ ...current, [key]: value }));
    setDraftValues((current) => ({ ...current, [key]: Number(nextValue.toPrecision(8)) }));
    setDigitalDirty(true);
  }

  function handlePwmCarrierChange(carrier: PwmCarrierMode) {
    setDraftPwmCarrier(carrier);
    setDigitalDirty(true);
  }

  function runDigitalAnalysis() {
    digitalParameterKeys.forEach((key) => {
      onValueChange(key, draftValues[key]);
      onUnitChange(key, draftUnits[key]);
    });
    onPwmCarrierChange(draftPwmCarrier);
    setDigitalRevision((current) => current + 1);
    setDigitalDirty(false);
  }

  return (
    <section className="workspace compensator-workspace digital-controller-workspace">
      <form className="input-panel compensator-input">
        <div className="panel-heading">
          <h2>{isZh ? "數位控制器參數" : "Digital Controller Parameters"}</h2>
          <button type="button" onClick={onOpenAnalog}>
            <Gauge aria-hidden="true" size={16} />
            {isZh ? "開啟類比補償器" : "Open analog compensator"}
          </button>
        </div>

        <section className="subpanel">
          <h3>
            <CircuitBoard aria-hidden="true" size={16} />
            {isZh ? "取樣、PWM 與 delay" : "Sampling, PWM, And Delay"}
          </h3>
          <p>
            {isZh
              ? "這裡只調整數位控制器實作參數；類比補償器的 Gc(s) 請回到類比頁面設計。"
              : "These settings only affect the digital implementation. Design the analog Gc(s) on the analog compensator page."}
          </p>
          <div className="field-grid">
            <NumberField fieldKey="samplingFrequency" locale={locale} values={draftValues} units={draftUnits} onChange={handleValueChange} onUnitChange={handleUnitChange} />
            <NumberField fieldKey="pwmFrequency" locale={locale} values={draftValues} units={draftUnits} onChange={handleValueChange} onUnitChange={handleUnitChange} />
            <NumberField fieldKey="pwmUpdateCycles" locale={locale} values={draftValues} units={draftUnits} onChange={handleValueChange} onUnitChange={handleUnitChange} />
            <label className="number-field">
              <span>PWM carrier type</span>
              <div>
                <select
                  aria-label="PWM carrier type"
                  value={draftPwmCarrier}
                  onChange={(event) => handlePwmCarrierChange(event.target.value as PwmCarrierMode)}
                >
                  {(Object.keys(pwmCarrierLabels) as PwmCarrierMode[]).map((carrier) => (
                    <option key={carrier} value={carrier}>
                      {pwmCarrierLabels[carrier]}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <NumberField fieldKey="dutyMin" locale={locale} values={draftValues} units={draftUnits} onChange={handleValueChange} onUnitChange={handleUnitChange} />
            <NumberField fieldKey="dutyMax" locale={locale} values={draftValues} units={draftUnits} onChange={handleValueChange} onUnitChange={handleUnitChange} />
            <NumberField fieldKey="initialDuty" locale={locale} values={draftValues} units={draftUnits} onChange={handleValueChange} onUnitChange={handleUnitChange} />
            <NumberField fieldKey="computationDelaySamples" locale={locale} values={draftValues} units={draftUnits} onChange={handleValueChange} onUnitChange={handleUnitChange} />
            <NumberField fieldKey="outputDelaySamples" locale={locale} values={draftValues} units={draftUnits} onChange={handleValueChange} onUnitChange={handleUnitChange} />
            <NumberField fieldKey="adcBits" locale={locale} values={draftValues} units={draftUnits} onChange={handleValueChange} onUnitChange={handleUnitChange} />
            <NumberField fieldKey="dpwmBits" locale={locale} values={draftValues} units={draftUnits} onChange={handleValueChange} onUnitChange={handleUnitChange} />
          </div>
        </section>

        <div className="analysis-actions">
          <button className="run-analysis" type="button" onClick={runDigitalAnalysis} disabled={!analogResult || !digitalDirty}>
            <Play aria-hidden="true" size={18} />
            {isZh ? "更新數位分析" : "Run Digital Analysis"}
          </button>
        </div>
      </form>

      {analogResult && digitalResult ? (
        <section className="result-panel">
          {analogDirty && (
            <div className="status warning">
              {isZh
                ? "類比補償器參數已變更。請回到類比頁重新執行分析，數位結果才會使用最新 Gc(s)。"
                : "Analog compensator settings changed. Re-run the analog analysis so the digital result uses the latest Gc(s)."}
            </div>
          )}
          {digitalDirty && (
            <div className="status warning">
              {isZh
                ? "數位控制器參數已變更。按「更新數位分析」後才會重新計算 Bode、delay、aliasing 與 SIMPLIS 輸出。"
                : "Digital controller settings changed. Run digital analysis to refresh Bode, delay, aliasing, and SIMPLIS outputs."}
            </div>
          )}
          <div className="summary-strip">
            <Metric label="Source" value={compensatorTypeLabels[analogResult.compensatorType]} />
            <Metric label="f_C" value={formatFrequency(analogResult.crossoverFrequency)} />
            <Metric label="Analog PM" value={formatOptionalPhase(analogResult.stabilityMargins.phaseMarginDeg)} />
            <Metric label="f_s" value={formatDigitalFrequency(digitalResult.samplingFrequency)} />
          </div>
          <MemoizedDigitalCompensatorPanel analogResult={analogResult} result={digitalResult} locale={locale} />
        </section>
      ) : (
        <section className="result-panel pending-panel">
          <h2>{isZh ? "請先完成類比補償器設計" : "Run The Analog Compensator First"}</h2>
          <p>
            {isZh
              ? "數位控制器會從類比補償器的 Gc(s) 離散化而來。請先到類比補償器頁匯入 Bode、設定 Type I/II/III，並執行分析。"
              : "The digital controller is discretized from the analog Gc(s). Open the analog compensator page, import the Bode data, choose Type I/II/III, and run analysis first."}
          </p>
          <button className="run-analysis" type="button" onClick={onOpenAnalog}>
            <Gauge aria-hidden="true" size={18} />
            {isZh ? "前往類比補償器" : "Go To Analog Compensator"}
          </button>
        </section>
      )}
    </section>
  );
}

function calculate(method: MethodId, values: NumericState, units: UnitState): CalculationResult {
  if (method === "ti") {
    return calculateTi({
      vdd: toSi(values.vdd, units.vdd),
      diodeDrop: toSi(values.diodeDrop, units.diodeDrop),
      vhbl: toSi(values.vhbl, units.vhbl),
      qg: toSi(values.qg, units.qg),
      ihbs: toSi(values.ihbs, units.ihbs),
      ihb: toSi(values.ihb, units.ihb),
      dmax: toSi(values.dmax, units.dmax),
      fsw: toSi(values.fsw, units.fsw),
      selectedCboot: toSi(values.selectedCboot, units.selectedCboot),
      cvdd: toSi(values.cvdd, units.cvdd),
      rboot: toSi(values.rboot, units.rboot),
    });
  }
  if (method === "onsemi") {
    return calculateOnsemi({
      vdd: toSi(values.vdd, units.vdd),
      diodeDrop: toSi(values.diodeDrop, units.diodeDrop),
      vgsMin: toSi(values.vgsMin, units.vgsMin),
      qGate: toSi(values.qGate, units.qGate),
      ilkCap: toSi(values.ilkCap, units.ilkCap),
      ilkGs: toSi(values.ilkGs, units.ilkGs),
      iqbs: toSi(values.iqbs, units.iqbs),
      ilk: toSi(values.ilk, units.ilk),
      ilkDiode: toSi(values.ilkDiode, units.ilkDiode),
      tOn: toSi(values.tOn, units.tOn),
      qls: toSi(values.qls, units.qls),
      selectedCboot: toSi(values.selectedCboot, units.selectedCboot),
      cvdd: toSi(values.cvdd, units.cvdd),
      vbsMax: toSi(values.vbsMax, units.vbsMax),
    });
  }
  return calculateInfineon({
    qgStar: toSi(values.qgStar, units.qgStar),
    leakage: toSi(values.leakage, units.leakage),
    fsw: toSi(values.fsw, units.fsw),
    duty: toSi(values.duty, units.duty),
    rboot: toSi(values.rboot, units.rboot),
    cboot: toSi(values.cboot, units.cboot),
    allowedVdrop: toSi(values.allowedVdrop, units.allowedVdrop),
    cvdd: toSi(values.cvdd, units.cvdd),
  });
}

function toSi(value: number, unitLabel: string): number {
  return value * getUnit(unitLabel).factor;
}

function fromSi(value: number, unitLabel: string): number {
  return value / getUnit(unitLabel).factor;
}

function getUnit(unitLabel: string): UnitOption {
  for (const options of Object.values(unitSets)) {
    const unit = options.find((option) => option.label === unitLabel);
    if (unit) {
      return unit;
    }
  }
  return { label: unitLabel, factor: 1 };
}

function TiFields(props: FieldProps) {
  return (
    <div className="field-grid">
      <NumberField fieldKey="vdd" {...props} />
      <NumberField fieldKey="diodeDrop" {...props} />
      <NumberField fieldKey="vhbl" {...props} />
      <NumberField fieldKey="qg" {...props} />
      <NumberField fieldKey="ihbs" {...props} />
      <NumberField fieldKey="ihb" {...props} />
      <NumberField fieldKey="dmax" {...props} />
      <NumberField fieldKey="fsw" {...props} />
      <NumberField fieldKey="selectedCboot" {...props} />
      <NumberField fieldKey="cvdd" {...props} />
      <NumberField fieldKey="rboot" {...props} />
    </div>
  );
}

function OnsemiFields(props: FieldProps) {
  return (
    <div className="field-grid">
      <NumberField fieldKey="vdd" {...props} />
      <NumberField fieldKey="diodeDrop" {...props} />
      <NumberField fieldKey="vgsMin" {...props} />
      <NumberField fieldKey="qGate" {...props} />
      <NumberField fieldKey="ilkCap" {...props} />
      <NumberField fieldKey="ilkGs" {...props} />
      <NumberField fieldKey="iqbs" {...props} />
      <NumberField fieldKey="ilk" {...props} />
      <NumberField fieldKey="ilkDiode" {...props} />
      <NumberField fieldKey="tOn" {...props} />
      <NumberField fieldKey="qls" {...props} />
      <NumberField fieldKey="selectedCboot" {...props} />
      <NumberField fieldKey="cvdd" {...props} />
      <NumberField fieldKey="vbsMax" {...props} />
    </div>
  );
}

function InfineonFields(props: FieldProps) {
  return (
    <div className="field-grid">
      <NumberField fieldKey="qgStar" {...props} />
      <NumberField fieldKey="leakage" {...props} />
      <NumberField fieldKey="fsw" {...props} />
      <NumberField fieldKey="duty" {...props} />
      <NumberField fieldKey="rboot" {...props} />
      <NumberField fieldKey="cboot" {...props} />
      <NumberField fieldKey="allowedVdrop" {...props} />
      <NumberField fieldKey="cvdd" {...props} />
    </div>
  );
}

type FieldProps = {
  locale: Locale;
  values: NumericState;
  units: UnitState;
  onChange: (key: string, value: number) => void;
  onUnitChange: (key: string, value: string) => void;
};

function NumberField({
  fieldKey,
  locale,
  values,
  units,
  onChange,
  onUnitChange,
}: FieldProps & { fieldKey: string }) {
  const unitType = fieldUnits[fieldKey];
  const options = unitSets[unitType] ?? [{ label: units[fieldKey], factor: 1 }];
  const labelMap: Record<string, string> = fieldLabels[locale];
  const label = labelMap[fieldKey] ?? fieldKey;
  return (
    <label className="number-field">
      <span>
        <EngineeringText text={label} />
      </span>
      <div>
        <input
          type="number"
          value={Number.isFinite(values[fieldKey]) ? values[fieldKey] : ""}
          step="any"
          onChange={(event) => onChange(fieldKey, Number(event.target.value))}
        />
        <select
          aria-label={`${label} unit`}
          value={units[fieldKey]}
          onChange={(event) => onUnitChange(fieldKey, event.target.value)}
        >
          {options.map((option) => (
            <option key={option.label} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function PendingPanel({ locale }: { locale: Locale }) {
  const t = translations[locale];
  return (
    <section className="result-panel pending-panel">
      <h2>{t.pendingTitle}</h2>
      <p>{t.pendingBody}</p>
    </section>
  );
}

function CsvSummary({
  locale,
  points,
  messages,
}: {
  locale: Locale;
  points: BodePoint[];
  messages: Message[];
}) {
  const t = translations[locale];
  if (points.length === 0) {
    return (
      <div className="csv-summary">
        <strong>{t.noBodeData}</strong>
        {messages.map((message, index) => (
          <p key={`${message.text}-${index}`} className={`message ${message.severity}`}>
            {message.text}
          </p>
        ))}
      </div>
    );
  }
  const min = points[0].frequency;
  const max = points[points.length - 1].frequency;
  return (
    <div className="csv-summary">
      <strong>{t.csvSummary}</strong>
      <span>
        {points.length} points, {formatFrequency(min)} to {formatFrequency(max)}
      </span>
      {messages.map((message, index) => (
        <p key={`${message.text}-${index}`} className={`message ${message.severity}`}>
          {message.text}
        </p>
      ))}
    </div>
  );
}

function CompensatorResultPanel({
  result,
  locale,
  dirty,
}: {
  result: CompensatorResult;
  locale: Locale;
  dirty: boolean;
}) {
  const t = translations[locale];
  const [copied, setCopied] = useState(false);
  const dangerCount = result.messages.filter((message) => message.severity === "danger").length;
  const simetrixText = locale === "zh"
    ? {
      title: "SIMetrix Laplace Expression",
      copy: copied ? "已複製" : "複製",
      aria: "SIMetrix Arbitrary Laplace Transform expression",
      note: "直接貼到 Arbitrary Laplace Transform Transfer Function；式中的 s 使用 rad/s。",
    }
    : {
      title: "SIMetrix Laplace Expression",
      copy: copied ? "Copied" : "Copy",
      aria: "SIMetrix Arbitrary Laplace Transform expression",
      note: "Paste directly into the Arbitrary Laplace Transform Transfer Function. The s-domain expression uses rad/s.",
    };

  async function copySimetrixExpression() {
    if (!result.simetrixLaplaceExpression) {
      return;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(result.simetrixLaplaceExpression);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = result.simetrixLaplaceExpression;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section className="result-panel">
      {dirty && <div className="status warning">{t.staleNotice}</div>}
      <div className="summary-strip">
        <Metric label="f_C" value={formatFrequency(result.crossoverFrequency)} />
        <Metric label="G" value={formatGainDb(20 * Math.log10(result.gainAtCrossover))} />
        <Metric
          label={result.compensatorType === "type1" ? "PM est" : "Boost"}
          value={
            result.compensatorType === "type1"
              ? formatPhaseDeg(result.estimatedPhaseMargin)
              : formatPhaseDeg(result.requiredPhaseBoostDeg)
          }
        />
        <Metric label="k" value={result.kFactor.toFixed(4)} />
      </div>

      <div className={dangerCount > 0 ? "status danger" : "status ok"}>
        {dangerCount > 0 ? `${dangerCount} ${t.critical}` : t.noCritical}
      </div>

      <section className="formula-panel">
        <h2>{t.bodeDisplay}</h2>
        <CombinedBodePlot result={result} locale={locale} />
      </section>

      <section className="formula-panel">
        <div className="panel-heading">
          <h2>{simetrixText.title}</h2>
          <button type="button" onClick={copySimetrixExpression} disabled={!result.simetrixLaplaceExpression}>
            <Copy aria-hidden="true" size={16} />
            {simetrixText.copy}
          </button>
        </div>
        <textarea
          className="parameter-preview simetrix-expression-preview"
          readOnly
          value={result.simetrixLaplaceExpression}
          aria-label={simetrixText.aria}
        />
        <p className="expression-note">{simetrixText.note}</p>
      </section>

      <section className="formula-panel">
        <h2>{t.componentValues}</h2>
        <div className="component-values-layout">
          <div className="component-table">
            <div className="component-row heading">
              <span>Symbol</span>
              <span>Ideal</span>
              <span>Recommended</span>
            </div>
            {result.components.map((component) => (
              <div key={component.label} className="component-row">
                <strong>
                  <EngineeringText text={component.label} />
                </strong>
                <span>{formatRawComponent(component)}</span>
                <span>{formatCompensatorComponent(component)}</span>
              </div>
            ))}
          </div>
          <section className="component-circuit-panel" aria-label={t.circuitDiagram}>
            <h3>{t.circuitDiagram}</h3>
            <CompensatorCircuitDiagram type={result.compensatorType} />
          </section>
        </div>
      </section>

      <CalculationSteps result={result} locale={locale} />

      <section className="message-panel">
        <h2>{t.designNotes}</h2>
        <div className="message-list">
          {result.messages.map((message, index) => (
            <p key={`${message.text}-${index}`} className={`message ${message.severity}`}>
              {message.text}
            </p>
          ))}
        </div>
      </section>
    </section>
  );
}

function formatRawComponent(component: {
  ideal: number;
  unit: "resistance" | "capacitance";
}): string {
  return component.unit === "resistance"
    ? formatCompensatorComponent({ ...component, label: "", recommended: component.ideal })
    : formatCapacitance(component.ideal);
}

function DigitalCompensatorPanel({
  analogResult,
  result,
  locale,
}: {
  analogResult: CompensatorResult;
  result: DigitalCompensatorResult;
  locale: Locale;
}) {
  const text = locale === "zh"
    ? {
      title: "數位控制器與 SIMPLIS DLL",
      coefficientTitle: "IIR 係數",
      controllerBodeTitle: "類比 / 數位控制器 Bode 比較",
      loopBodeTitle: "數位 Loop Gain 與 Delay Margin",
      delayBudgetTitle: "Delay budget",
      aliasingTitle: "Sampling & Aliasing 診斷",
      parameterTitle: "SIMPLIS 參數",
      codeTitle: "C-Code DLL 核心片段",
      guideTitle: "SIMPLIS DLL 使用說明",
      downloadParams: "下載參數",
      downloadCode: "下載 C code",
      numerator: "Numerator",
      denominator: "Denominator",
      digitalPm: "Digital PM",
      delayPm: "Delay PM",
      delaySamples: "Delay samples",
      pwmCarrier: "PWM carrier",
      pwmAttenuation: "PWM attenuation",
    }
    : {
      title: "Digital Controller And SIMPLIS DLL",
      coefficientTitle: "IIR Coefficients",
      controllerBodeTitle: "Analog / Digital Controller Bode",
      loopBodeTitle: "Digital Loop Gain And Delay Margin",
      delayBudgetTitle: "Delay budget",
      aliasingTitle: "Sampling & Aliasing Diagnostics",
      parameterTitle: "SIMPLIS Parameters",
      codeTitle: "C-Code DLL Core",
      guideTitle: "SIMPLIS DLL Usage Guide",
      downloadParams: "Download params",
      downloadCode: "Download C code",
      numerator: "Numerator",
      denominator: "Denominator",
      digitalPm: "Digital PM",
      delayPm: "Delay PM",
      delaySamples: "Delay samples",
      pwmCarrier: "PWM carrier",
      pwmAttenuation: "PWM attenuation",
    };

  function downloadText(fileName: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="formula-panel digital-compensator-panel">
      <div className="panel-heading">
        <h2>{text.title}</h2>
      </div>
      <div className="summary-strip">
        <Metric label="f_s" value={formatDigitalFrequency(result.samplingFrequency)} />
        <Metric label="f_PWM" value={formatDigitalFrequency(result.pwmFrequency)} />
        <Metric label="PWM update" value={`${trimFixed(result.pwmUpdateCycles, 3)} cycles`} />
        <Metric label="T_s" value={formatSamplingPeriod(result.samplingPeriod)} />
        <Metric label="IIR order" value={`${result.order}`} />
        <Metric label={text.delaySamples} value={trimFixed(result.delayBudget.totalDelaySamples, 3)} />
      </div>

      <section className="formula-panel">
        <h2>{text.delayBudgetTitle}</h2>
        <div className="summary-strip">
          <Metric label="T_delay" value={formatSamplingPeriod(result.delayBudget.totalDelaySeconds)} />
          <Metric label="Delay at f_C" value={formatPhaseDeg(result.delayBudget.phaseAtCrossoverDeg)} />
          <Metric label={text.pwmCarrier} value={pwmCarrierLabels[result.pwmCarrier]} />
          <Metric label={text.pwmAttenuation} value={formatGainDb(result.delayBudget.pwmMagnitudeAtCrossoverDb)} />
          <Metric label={text.digitalPm} value={formatOptionalPhase(result.digitalStabilityMargins.phaseMarginDeg)} />
          <Metric label={text.delayPm} value={formatOptionalPhase(result.digitalDelayStabilityMargins.phaseMarginDeg)} />
        </div>
        <div className="delay-breakdown">
          {result.delayBudget.components.map((component) => (
            <div className="delay-breakdown-row" key={component.label}>
              <span>{component.label}</span>
              <strong>{formatSamplingPeriod(component.seconds)}</strong>
              <small>{trimFixed(component.samples, 3)} samples</small>
            </div>
          ))}
        </div>
      </section>

      <DigitalParameterGuide locale={locale} />

      <DigitalAliasingPanel result={result} locale={locale} title={text.aliasingTitle} />

      <section className="formula-panel">
        <h2>{text.controllerBodeTitle}</h2>
        <DigitalControllerBodePlot analogResult={analogResult} result={result} />
      </section>

      <section className="formula-panel">
        <h2>{text.loopBodeTitle}</h2>
        <DigitalLoopBodePlot analogResult={analogResult} result={result} locale={locale} />
      </section>

      <section className="formula-panel">
        <h2>{text.coefficientTitle}</h2>
        <div className="digital-coefficient-grid">
          <div className="component-table">
            <div className="component-row heading">
              <span>{text.numerator}</span>
              <span>Value</span>
              <span>SIMPLIS</span>
            </div>
            {result.bCoefficients.map((coefficient) => (
              <div className="component-row" key={coefficient.label}>
                <strong>{coefficient.label}</strong>
                <span>{formatCoefficient(coefficient.value)}</span>
                <span>{coefficient.label.toUpperCase()}</span>
              </div>
            ))}
          </div>
          <div className="component-table">
            <div className="component-row heading">
              <span>{text.denominator}</span>
              <span>Value</span>
              <span>SIMPLIS</span>
            </div>
            {result.aCoefficients.map((coefficient) => (
              <div className="component-row" key={coefficient.label}>
                <strong>{coefficient.label}</strong>
                <span>{formatCoefficient(coefficient.value)}</span>
                <span>{coefficient.label.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="formula-panel">
        <div className="panel-heading">
          <h2>{text.parameterTitle}</h2>
          <button type="button" onClick={() => downloadText("simplis_digital_compensator_params.txt", result.parameterText)}>
            <Download aria-hidden="true" size={16} />
            {text.downloadParams}
          </button>
        </div>
        <textarea className="parameter-preview" readOnly value={result.parameterText} aria-label="SIMPLIS DLL parameters" />
      </section>

      <section className="formula-panel">
        <div className="panel-heading">
          <h2>{text.codeTitle}</h2>
          <button type="button" onClick={() => downloadText("digital_compensator_core.c", result.cCode)}>
            <Download aria-hidden="true" size={16} />
            {text.downloadCode}
          </button>
        </div>
        <textarea className="script-preview digital-code-preview" readOnly value={result.cCode} aria-label="SIMPLIS C-Code DLL core" />
      </section>

      <SimplisDllGuide locale={locale} order={result.order} />

      <section className="message-panel">
        <h2>{locale === "zh" ? "數位控制器注意事項" : "Digital Controller Notes"}</h2>
        <div className="message-list">
          {result.messages.map((message, index) => (
            <p key={`${message.text}-${index}`} className={`message ${message.severity}`}>
              {message.text}
            </p>
          ))}
        </div>
      </section>
    </section>
  );
}

const MemoizedDigitalCompensatorPanel = memo(DigitalCompensatorPanel);

function formatDigitalFrequency(hertz: number): string {
  if (!Number.isFinite(hertz)) {
    return "Invalid";
  }
  if (Math.abs(hertz) >= 1e6) {
    return `${trimFixed(hertz / 1e6, 3)} MHz`;
  }
  if (Math.abs(hertz) >= 1e3) {
    return `${trimFixed(hertz / 1e3, 3)} kHz`;
  }
  return `${trimFixed(hertz, 2)} Hz`;
}

function DigitalControllerBodePlot({
  analogResult,
  result,
}: {
  analogResult: CompensatorResult;
  result: DigitalCompensatorResult;
}) {
  return (
    <DigitalBodePlot
      title="Controller Bode"
      traces={[
        { name: "G<sub>c</sub>(s)", points: analogResult.compensatorBode, color: "#d95319" },
        { name: "G<sub>c</sub>(z)", points: result.digitalBode, color: "#2563eb" },
        { name: "G<sub>c</sub>(z)G<sub>PWM</sub>", points: result.digitalWithDelayBode, color: "#7e2f8e", dash: "dash" },
      ]}
      samplingFrequency={result.samplingFrequency}
    />
  );
}

function DigitalAliasingPanel({
  result,
  locale,
  title,
}: {
  result: DigitalCompensatorResult;
  locale: Locale;
  title: string;
}) {
  const isZh = locale === "zh";
  const rows = result.aliasingDiagnostics.rows;
  if (rows.length === 0) {
    return (
      <section className="formula-panel digital-aliasing-panel">
        <h2>{title}</h2>
        <p className="message warning">
          {isZh ? "目前沒有足夠的頻率範圍可建立 aliasing 診斷。" : "No frequency range is available for aliasing diagnostics."}
        </p>
      </section>
    );
  }
  return (
    <section className="formula-panel digital-aliasing-panel">
      <h2>{title}</h2>
      <div className="summary-strip compact">
        <Metric label="Nyquist" value={formatFrequency(result.aliasingDiagnostics.nyquistFrequency)} />
        <Metric label="f_update" value={formatFrequency(result.aliasingDiagnostics.updateFrequency)} />
        <Metric label="f_PWM" value={formatFrequency(result.pwmFrequency)} />
      </div>
      <p className="chart-help">
        {isZh
          ? "這張表是在檢查一件事：PWM 產生的高頻雜訊，會不會被數位取樣誤看成低頻雜訊。若折回強度越接近 0 dB，代表這個假低頻越強，越容易干擾控制器。"
          : "This table checks whether high-frequency PWM noise can be misread as low-frequency noise after digital sampling. Foldback strength closer to 0 dB means the false low-frequency component is stronger and more likely to disturb the controller."}
      </p>
      <div className="aliasing-explainer">
        <div>
          <strong>{isZh ? "怎麼看" : "How to read it"}</strong>
          <p>
            {isZh
              ? "可以把它想成相機拍高速旋轉的輪子：輪子其實轉很快，但畫面可能看起來很慢，甚至像倒轉。數位控制器取樣 PWM 雜訊時也類似；原本在高頻的雜訊，取樣後可能看起來像低頻訊號。"
              : "Think of a camera filming a fast spinning wheel: the wheel is moving quickly, but the video can make it look slow or even reversed. Digital sampling can do the same to PWM noise: a high-frequency component may appear as a low-frequency signal."}
          </p>
        </div>
        <div>
          <strong>{isZh ? "表格例子" : "Table example"}</strong>
          <p>
            {isZh
              ? "第一列的意思是：原本有一個靠近 100 kHz PWM 的 95 kHz 雜訊；控制器每 10 us 看一次訊號時，它可能被看成 5 kHz。折回強度 -4 dB 表示它沒有小很多，所以這列標成高風險。"
              : "The first row means: a 95 kHz noise component near the 100 kHz PWM may be seen as 5 kHz when the controller samples every 10 us. A -4 dB foldback strength means it is not much smaller, so the row is high risk."}
          </p>
        </div>
      </div>
      <div className="aliasing-table">
        <div className="aliasing-row heading">
          <span>{isZh ? "低頻擾動 f_m" : "Disturbance f_m"}</span>
          <span>{isZh ? "PWM 旁帶 f_PWM - f_m" : "PWM sideband f_PWM - f_m"}</span>
          <span>{isZh ? "取樣後看成" : "Seen after sampling"}</span>
          <span>{isZh ? "折回強度" : "Foldback strength"}</span>
          <span>{isZh ? "風險" : "risk"}</span>
        </div>
        {rows.map((row) => (
          <div className={`aliasing-row ${row.severity}`} key={`${row.modulationFrequency}-${row.lowerSidebandFrequency}`}>
            <span>{formatFrequency(row.modulationFrequency)}</span>
            <span>{formatFrequency(row.lowerSidebandFrequency)}</span>
            <span>{formatFrequency(row.aliasFrequency)}</span>
            <span>{formatGainDb(row.aliasToDirectRatioDb)}</span>
            <strong>{formatAliasRisk(row.severity, locale)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatAliasRisk(severity: "ok" | "warning" | "danger", locale: Locale): string {
  if (locale === "zh") {
    if (severity === "danger") {
      return "高";
    }
    if (severity === "warning") {
      return "中";
    }
    return "低";
  }
  if (severity === "danger") {
    return "High";
  }
  if (severity === "warning") {
    return "Medium";
  }
  return "Low";
}

function DigitalLoopBodePlot({
  analogResult,
  result,
  locale,
}: {
  analogResult: CompensatorResult;
  result: DigitalCompensatorResult;
  locale: Locale;
}) {
  const t = translations[locale];
  return (
    <div className="digital-loop-panel">
      <DigitalBodePlot
        title="Loop Gain Bode"
        traces={[
          { name: "T(s)", points: analogResult.loopGainBode, color: "#77ac30" },
          { name: "T(z)", points: result.digitalLoopGainBode, color: "#2563eb" },
          { name: "T(z) with PWM delay", points: result.digitalLoopGainWithDelayBode, color: "#7e2f8e", dash: "dash" },
        ]}
        samplingFrequency={result.samplingFrequency}
        showUnityLines
      />
      <div className="margin-panel digital-margin-panel">
        <Metric label={`Analog ${t.phaseMargin}`} value={formatOptionalPhase(analogResult.stabilityMargins.phaseMarginDeg)} />
        <Metric label={`Digital ${t.phaseMargin}`} value={formatOptionalPhase(result.digitalStabilityMargins.phaseMarginDeg)} />
        <Metric label={`Delay ${t.phaseMargin}`} value={formatOptionalPhase(result.digitalDelayStabilityMargins.phaseMarginDeg)} />
        <Metric label={`Delay ${t.gainCrossover}`} value={formatOptionalFrequency(result.digitalDelayStabilityMargins.gainCrossoverFrequency)} />
      </div>
    </div>
  );
}

function DigitalBodePlot({
  title,
  traces,
  samplingFrequency,
  showUnityLines = false,
}: {
  title: string;
  traces: Array<{
    name: string;
    points: CompensatorBodePoint[];
    color: string;
    dash?: "solid" | "dash" | "dot";
  }>;
  samplingFrequency: number;
  showUnityLines?: boolean;
}) {
  const points = traces.flatMap((trace) => trace.points);
  if (points.length < 2) {
    return <p className="message warning">No digital Bode data is available.</p>;
  }
  const magnitudeValues = points.map((point) => point.magnitudeDb).filter(Number.isFinite);
  const phaseValues = points.map((point) => point.phaseDeg).filter(Number.isFinite);
  const magMin = Math.min(...magnitudeValues);
  const magMax = Math.max(...magnitudeValues);
  const phaseMin = Math.min(...phaseValues);
  const phaseMax = Math.max(...phaseValues);
  const data = traces.flatMap((trace) => bodeTraces(trace.name, trace.points, trace.color, trace.dash));
  const shapes: Partial<Shape>[] = [
    ...samplingGuideShapes(samplingFrequency),
    ...(showUnityLines ? unityMarginShapes() : []),
  ];
  const layout: Partial<Layout> = {
    autosize: true,
    height: 600,
    margin: { l: 82, r: 34, t: 82, b: 70 },
    hovermode: "x unified",
    legend: { orientation: "h", x: 0.02, y: 1.12, yanchor: "bottom" },
    plot_bgcolor: "#ffffff",
    paper_bgcolor: "#ffffff",
    xaxis: {
      type: "log",
      domain: [0.08, 1],
      anchor: "y",
      matches: "x2",
      showticklabels: false,
      showgrid: true,
      gridcolor: "#d0d0d0",
      minor: { showgrid: true, gridcolor: "#e5e5e5" },
    },
    yaxis: {
      domain: [0.56, 1],
      title: { text: "Magnitude (dB)" },
      range: [magMin - 8, magMax + 10],
      zeroline: true,
      zerolinecolor: "#555555",
      showgrid: true,
      gridcolor: "#d0d0d0",
    },
    xaxis2: {
      type: "log",
      domain: [0.08, 1],
      anchor: "y2",
      matches: "x",
      title: { text: "Frequency (Hz)" },
      showgrid: true,
      gridcolor: "#d0d0d0",
      minor: { showgrid: true, gridcolor: "#e5e5e5" },
    },
    yaxis2: {
      domain: [0, 0.44],
      title: { text: "Phase (deg)" },
      range: [phaseMin - 20, phaseMax + 20],
      showgrid: true,
      gridcolor: "#d0d0d0",
    },
    shapes,
    annotations: samplingGuideAnnotations(samplingFrequency),
  };
  const config: Partial<Config> = {
    responsive: true,
    scrollZoom: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  };

  return (
    <div className="bode-plot-panel">
      <h3 className="bode-panel-title">{title}</h3>
      <Plot className="plotly-bode-chart digital-bode-chart" data={data} layout={layout} config={config} useResizeHandler />
      <p className="chart-help">Dashed sampling guides mark f_s/20 and f_s/10. Pure delay changes phase; symmetric PWM can also attenuate magnitude.</p>
    </div>
  );
}

function samplingGuideShapes(samplingFrequency: number): Partial<Shape>[] {
  return [samplingFrequency / 20, samplingFrequency / 10]
    .filter((frequency) => Number.isFinite(frequency) && frequency > 0)
    .map((frequency, index) => ({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: frequency,
      x1: frequency,
      y0: 0,
      y1: 1,
      line: { color: index === 0 ? "#64748b" : "#a2142f", width: 1.2, dash: "dot" },
    }));
}

function samplingGuideAnnotations(samplingFrequency: number): NonNullable<Layout["annotations"]> {
  return [
    { frequency: samplingFrequency / 20, label: "f_s/20" },
    { frequency: samplingFrequency / 10, label: "f_s/10" },
  ]
    .filter((item) => Number.isFinite(item.frequency) && item.frequency > 0)
    .map((item) => ({
      x: item.frequency,
      y: 1,
      xref: "x",
      yref: "paper",
      text: item.label,
      showarrow: false,
      yshift: 10,
      font: { color: "#475569", size: 11 },
    })) as NonNullable<Layout["annotations"]>;
}

function unityMarginShapes(): Partial<Shape>[] {
  return [
    {
      type: "line",
      xref: "paper",
      yref: "y",
      x0: 0.08,
      x1: 1,
      y0: 0,
      y1: 0,
      line: { color: "#555555", width: 1, dash: "dot" },
    },
    {
      type: "line",
      xref: "paper",
      yref: "y2",
      x0: 0.08,
      x1: 1,
      y0: -180,
      y1: -180,
      line: { color: "#555555", width: 1, dash: "dot" },
    },
  ];
}

type DigitalGuideParameter = {
  key: string;
  title: string;
  delayImpact: "direct" | "indirect" | "none";
  affects: string;
  adjustWhen: string;
  leaveWhen: string;
  example: string;
  formulas: string[];
  delayLink?: string;
};

const pwmCarrierGuideItems: Array<{
  key: PwmCarrierMode;
  title: string;
  formula: string;
  noteZh: string;
  noteEn: string;
}> = [
  {
    key: "none",
    title: "Pure delay only",
    formula: "T_PWM_delay = 0",
    noteZh: "PWM modulator delay 已由其他模型包含時使用。",
    noteEn: "Use when PWM modulator delay is already included elsewhere.",
  },
  {
    key: "trailing-edge",
    title: "Trailing-edge sawtooth",
    formula: "T_PWM_delay = D * T_PWM",
    noteZh: "與 duty 有關；duty 越大，等效 delay 越大。",
    noteEn: "Duty-dependent; delay increases as duty increases.",
  },
  {
    key: "leading-edge",
    title: "Leading-edge sawtooth",
    formula: "T_PWM_delay = (1 - D) * T_PWM",
    noteZh: "與 duty 有關；duty 越大，等效 delay 越小。",
    noteEn: "Duty-dependent; delay decreases as duty increases.",
  },
  {
    key: "symmetric",
    title: "Symmetric PWM",
    formula: "T_PWM_delay = 0.5 * T_PWM",
    noteZh: "本工具用 |cos(pi*f/f_PWM)| 估算對稱 PWM 的增益衰減。",
    noteEn: "|G_PWM| ~= |cos(pi*f/f_PWM)| in this tool.",
  },
];

function DigitalParameterGuide({ locale }: { locale: Locale }) {
  const isZh = locale === "zh";
  const delayImpactText = {
    direct: isZh ? "直接影響 delay" : "Direct delay impact",
    indirect: isZh ? "間接影響 delay" : "Indirect delay impact",
    none: isZh ? "不影響小訊號 delay" : "No small-signal delay impact",
  };
  const parameters: DigitalGuideParameter[] = isZh
    ? [
      {
        key: "fs",
        title: "f_s 數位控制器取樣頻率",
        delayImpact: "indirect",
        affects: "決定 IIR 更新速度、Nyquist 頻率，以及每一個 sample delay 代表多少時間。",
        adjustWhen: "當 MCU/DSP 實際控制中斷頻率改變，或 crossover 已接近 f_s/10 時要調整。",
        leaveWhen: "若控制器每個 PWM 週期更新一次，通常設成等於 f_PWM。",
        example: "f_s = 100 kHz 時，1 sample = 10 us；若 OUTPUT_DELAY = 1，就會在 10 kHz 造成約 -36 deg 相位落後。",
        formulas: ["T_s = 1 / f_s", "f_Nyquist = f_s / 2", "phase_delay = -360 deg * f * N_delay * T_s"],
      },
      {
        key: "fpwm",
        title: "f_PWM PWM carrier 頻率",
        delayImpact: "direct",
        affects: "決定 PWM modulator 的等效 delay，以及 symmetric PWM 的高頻增益衰減。",
        adjustWhen: "當實際 switching frequency 與控制取樣頻率不同時要分開設定。",
        leaveWhen: "若控制更新與 PWM 同步且一個 PWM 週期更新一次，可先設成與 f_s 相同。",
        example: "f_PWM = 100 kHz、trailing-edge、D = 10% 時，PWM delay 約 1 us；D = 50% 時會變成 5 us。",
        formulas: ["T_PWM = 1 / f_PWM", "f_c target <= f_PWM / 10"],
        delayLink: "對應上圖：carrier delay",
      },
      {
        key: "update-cycles",
        title: "PWM_UPDATE_CYCLES 每 N 週期更新一次",
        delayImpact: "direct",
        affects: "描述 duty 每幾個 PWM 週期才更新一次。N > 1 時，duty hold 會多出低頻群延遲，phase margin 會再下降。",
        adjustWhen: "當控制器不是每個 PWM cycle 都更新，例如每 2、4 或更多個 switching cycle 才跑一次控制迴圈。",
        leaveWhen: "若 ADC、控制 ISR、PWM shadow load 每個 PWM 週期同步更新，就維持 1。",
        example: "f_PWM = 100 kHz、N = 4 時，額外 hold delay 約 (4 - 1)/2 * 10 us = 15 us。",
        formulas: ["f_update = f_PWM / N", "T_update_hold ~= (N - 1) * T_PWM / 2", "T_delay,total includes T_update_hold"],
        delayLink: "對應上圖：N-cycle update hold",
      },
      {
        key: "carrier",
        title: "PWM carrier type",
        delayImpact: "direct",
        affects: "決定 PWM modulator delay 的公式。Trailing-edge 與 duty 有關；symmetric 通常約半個 PWM 週期。",
        adjustWhen: "當 SIMPLIS/MCU 使用不同 PWM 對齊方式，例如 trailing-edge、leading-edge 或 center-aligned PWM。",
        leaveWhen: "若尚未確認硬體 PWM 模式，先用最接近 IC/韌體預設的 trailing-edge 做保守估算。",
        example: "Buck 常見 trailing-edge PWM；center-aligned 或 up-down counter 比較接近 symmetric PWM。",
        formulas: ["trailing: T_PWM_delay = D*T_PWM", "leading: T_PWM_delay = (1-D)*T_PWM", "symmetric: T_PWM_delay = T_PWM/2"],
        delayLink: "對應上圖：carrier delay",
      },
      {
        key: "duty",
        title: "DUTY_MIN / DUTY_MAX / INITIAL_DUTY",
        delayImpact: "indirect",
        affects: "限制輸出 duty 範圍、設定模擬起始 duty，並影響 duty-dependent PWM delay。",
        adjustWhen: "當 converter 操作點、輸入輸出範圍、保護限制或 startup 初始 duty 改變時。",
        leaveWhen: "若只是比較 analog/digital loop shape，且不研究飽和或啟動，可以先維持預設範圍。",
        example: "12 V 轉 1.2 V buck 初始 duty 可先設 10%；若低壓大 duty boost，INITIAL_DUTY 應改到接近穩態 duty。",
        formulas: ["D = V_OUT / V_IN for ideal buck", "D_cmd = clamp(D_raw, DUTY_MIN, DUTY_MAX)", "trailing PWM delay uses INITIAL_DUTY as D"],
      },
      {
        key: "compute",
        title: "COMPUTE_DELAY 計算延遲",
        delayImpact: "direct",
        affects: "代表 ADC 取樣後到 duty 計算完成的延遲，主要吃掉 phase margin。",
        adjustWhen: "當韌體需要下一個 ISR 才更新 duty、平均取樣、多通道計算或 DMA latency 明顯時。",
        leaveWhen: "若控制程式在同一個 ISR 內立即完成並寫入 PWM shadow register，可先用 0 到 0.5 sample。",
        example: "f_s = 100 kHz，COMPUTE_DELAY = 0.5 代表 5 us，在 10 kHz 約 -18 deg。",
        formulas: ["T_compute = COMPUTE_DELAY * T_s", "phase_compute = -360 deg * f_c * T_compute"],
        delayLink: "對應上圖：計算延遲",
      },
      {
        key: "output",
        title: "OUTPUT_DELAY 輸出延遲",
        delayImpact: "direct",
        affects: "代表 duty 寫入後到 PWM 實際採用的 sample 延遲，通常來自 shadow register 或下一週期更新。",
        adjustWhen: "當 PWM register 只在週期邊界載入，或 SIMPLIS DLL 有刻意延遲 duty bus 輸出時。",
        leaveWhen: "若 PWM 寫入可立即生效且模擬已包含 carrier delay，可設為 0。",
        example: "大多數數位 PWM 使用 shadow load，常見 OUTPUT_DELAY = 1 sample 作為保守估算。",
        formulas: ["T_output = OUTPUT_DELAY * T_s", "phase_output = -360 deg * f_c * T_output"],
        delayLink: "對應上圖：輸出延遲",
      },
      {
        key: "resolution",
        title: "ADC_BITS / DPWM_BITS 解析度",
        delayImpact: "none",
        affects: "影響量化誤差、limit cycle 風險與可達的 duty step；目前主要輸出到 SIMPLIS DLL 參數。",
        adjustWhen: "當實際 ADC 或 DPWM 解析度已知，或需要評估低振幅誤差與 duty granularity。",
        leaveWhen: "若現在只看線性 Bode 與 delay margin，解析度不會改變連續小訊號 Bode，可先不用調。",
        example: "10-bit DPWM 的 duty step 約 0.098%；若輸出電壓 ripple 或 limit cycle 很敏感，需要提高 DPWM bits。",
        formulas: ["ADC_LSB = V_ADC_FS / (2^ADC_BITS - 1)", "DPWM duty step = 1 / 2^DPWM_BITS", "D_quantized = round(D_cmd * 2^DPWM_BITS) / 2^DPWM_BITS"],
      },
    ]
    : [
      {
        key: "fs",
        title: "f_s digital sampling frequency",
        delayImpact: "indirect",
        affects: "Sets IIR update rate, Nyquist frequency, and the time represented by one sample of delay.",
        adjustWhen: "Adjust when the MCU/DSP interrupt rate changes or crossover approaches f_s/10.",
        leaveWhen: "If the controller updates once per PWM cycle, start with f_s equal to f_PWM.",
        example: "At f_s = 100 kHz, one sample is 10 us; OUTPUT_DELAY = 1 adds about -36 deg at 10 kHz.",
        formulas: ["T_s = 1 / f_s", "f_Nyquist = f_s / 2", "phase_delay = -360 deg * f * N_delay * T_s"],
      },
      {
        key: "fpwm",
        title: "f_PWM PWM carrier frequency",
        delayImpact: "direct",
        affects: "Sets PWM modulator delay and symmetric-PWM high-frequency attenuation.",
        adjustWhen: "Adjust when switching frequency and control sampling frequency are different.",
        leaveWhen: "If PWM and control update are synchronous once per cycle, keep it equal to f_s.",
        example: "At 100 kHz trailing-edge PWM, D = 10% gives about 1 us PWM delay; D = 50% gives 5 us.",
        formulas: ["T_PWM = 1 / f_PWM", "f_c target <= f_PWM / 10"],
        delayLink: "Maps to figure: carrier delay",
      },
      {
        key: "update-cycles",
        title: "PWM_UPDATE_CYCLES update every N PWM cycles",
        delayImpact: "direct",
        affects: "Describes how many PWM periods pass before the duty command is refreshed. N > 1 adds low-frequency hold delay and reduces phase margin.",
        adjustWhen: "Adjust when the controller runs every 2, 4, or more switching cycles instead of every PWM cycle.",
        leaveWhen: "Keep 1 when ADC sampling, control ISR, and PWM shadow load update every PWM cycle.",
        example: "At f_PWM = 100 kHz and N = 4, extra hold delay is about (4 - 1)/2 * 10 us = 15 us.",
        formulas: ["f_update = f_PWM / N", "T_update_hold ~= (N - 1) * T_PWM / 2", "T_delay,total includes T_update_hold"],
        delayLink: "Maps to figure: N-cycle update hold",
      },
      {
        key: "carrier",
        title: "PWM carrier type",
        delayImpact: "direct",
        affects: "Selects the PWM delay formula. Trailing-edge is duty-dependent; symmetric is roughly half a PWM period.",
        adjustWhen: "Adjust when the SIMPLIS/MCU PWM alignment is known.",
        leaveWhen: "If unknown, trailing-edge is a practical first pass for many buck controllers.",
        example: "Center-aligned or up-down-counter PWM is closer to symmetric PWM.",
        formulas: ["trailing: T_PWM_delay = D*T_PWM", "leading: T_PWM_delay = (1-D)*T_PWM", "symmetric: T_PWM_delay = T_PWM/2"],
        delayLink: "Maps to figure: carrier delay",
      },
      {
        key: "duty",
        title: "DUTY_MIN / DUTY_MAX / INITIAL_DUTY",
        delayImpact: "indirect",
        affects: "Limits duty range, sets startup duty, and affects duty-dependent PWM delay.",
        adjustWhen: "Adjust for operating point, line/load range, protection limits, or startup study.",
        leaveWhen: "If only comparing analog/digital loop shape, defaults are usually fine.",
        example: "A 12 V to 1.2 V buck can start near 10% duty; a boost at high duty should use its expected steady-state duty.",
        formulas: ["D = V_OUT / V_IN for ideal buck", "D_cmd = clamp(D_raw, DUTY_MIN, DUTY_MAX)", "trailing PWM delay uses INITIAL_DUTY as D"],
      },
      {
        key: "compute",
        title: "COMPUTE_DELAY",
        delayImpact: "direct",
        affects: "Models ADC-to-duty calculation latency and directly reduces phase margin.",
        adjustWhen: "Adjust for next-ISR updates, averaging, DMA latency, or heavy control code.",
        leaveWhen: "Use 0 to 0.5 sample if the ISR computes and writes the PWM shadow register immediately.",
        example: "At f_s = 100 kHz, COMPUTE_DELAY = 0.5 is 5 us and about -18 deg at 10 kHz.",
        formulas: ["T_compute = COMPUTE_DELAY * T_s", "phase_compute = -360 deg * f_c * T_compute"],
        delayLink: "Maps to figure: compute delay",
      },
      {
        key: "output",
        title: "OUTPUT_DELAY",
        delayImpact: "direct",
        affects: "Models the delay from duty write to actual PWM use, often from shadow-register load timing.",
        adjustWhen: "Adjust when PWM registers load only at the next carrier boundary or the DLL delays the duty bus.",
        leaveWhen: "Set 0 if PWM duty takes effect immediately and carrier delay is already modeled.",
        example: "For shadow-load digital PWM, OUTPUT_DELAY = 1 sample is a conservative starting point.",
        formulas: ["T_output = OUTPUT_DELAY * T_s", "phase_output = -360 deg * f_c * T_output"],
        delayLink: "Maps to figure: output delay",
      },
      {
        key: "resolution",
        title: "ADC_BITS / DPWM_BITS",
        delayImpact: "none",
        affects: "Affects quantization, limit-cycle risk, and duty granularity; exported to SIMPLIS DLL parameters.",
        adjustWhen: "Adjust when real ADC/DPWM resolution is known or quantization behavior matters.",
        leaveWhen: "For linear Bode and delay-margin checks, resolution does not change the small-signal Bode.",
        example: "A 10-bit DPWM has about 0.098% duty step; sensitive designs may need more DPWM bits.",
        formulas: ["ADC_LSB = V_ADC_FS / (2^ADC_BITS - 1)", "DPWM duty step = 1 / 2^DPWM_BITS", "D_quantized = round(D_cmd * 2^DPWM_BITS) / 2^DPWM_BITS"],
      },
    ];

  return (
    <details className="calculation-steps digital-parameter-guide" open>
      <summary>
        <span>{isZh ? "數位控制器參數說明" : "Digital Controller Parameter Guide"}</span>
        <small>
          {isZh
            ? "每個欄位會影響什麼、何時該調整，以及常見起始值。"
            : "What each field affects, when to adjust it, and practical starting values."}
        </small>
      </summary>
      <div className="digital-guide-layout">
        <section className="delay-equation-panel">
          <h3>{isZh ? "總輸出 delay 來自誰" : "Where total output delay comes from"}</h3>
          <div className="formula-list">
            <code>T_delay,total = T_compute + T_output + T_PWM + T_update_hold</code>
            <code>T_compute = COMPUTE_DELAY * T_s</code>
            <code>T_output = OUTPUT_DELAY * T_s</code>
            <code>T_update_hold ~= (PWM_UPDATE_CYCLES - 1) * T_PWM / 2</code>
            <code>phase_delay = -360 deg * f * T_delay,total</code>
          </div>
          <p>
            {isZh
              ? "其中 T_PWM 由 PWM carrier type 決定；如果每個 PWM 週期都更新，PWM_UPDATE_CYCLES = 1，T_update_hold = 0。"
              : "T_PWM is selected by PWM carrier type. If duty updates every PWM cycle, PWM_UPDATE_CYCLES = 1 and T_update_hold = 0."}
          </p>
        </section>

        <figure className="n-cycle-hold-figure" aria-label={isZh ? "N 週期更新延遲來源圖" : "N-cycle update delay derivation"}>
          <h3>{isZh ? "為什麼 N 週期更新會多出 hold delay" : "Why N-cycle updates add hold delay"}</h3>
          <div className="hold-timeline-grid">
            <div className="hold-row-label">
              <strong>N = 1</strong>
              <span>{isZh ? "每週期更新" : "update every cycle"}</span>
            </div>
            <div className="hold-row baseline">
              <div className="hold-cycle active">D0</div>
              <div className="hold-cycle">D1</div>
              <div className="hold-cycle">D2</div>
              <div className="hold-cycle">D3</div>
              <span className="hold-center baseline-center">T_PWM / 2</span>
            </div>

            <div className="hold-row-label">
              <strong>N = 4</strong>
              <span>{isZh ? "每 4 週期更新" : "update every 4 cycles"}</span>
            </div>
            <div className="hold-row n-cycle">
              <div className="hold-cycle active">D0</div>
              <div className="hold-cycle active">D0</div>
              <div className="hold-cycle active">D0</div>
              <div className="hold-cycle active">D0</div>
              <span className="hold-center n-center">N*T_PWM / 2</span>
            </div>

            <div className="hold-row-label">
              <strong>{isZh ? "額外延遲" : "extra delay"}</strong>
              <span>{isZh ? "相對 N=1" : "relative to N=1"}</span>
            </div>
            <div className="hold-extra-row">
              <span className="hold-extra baseline-point" />
              <span className="hold-extra n-point" />
              <span className="hold-extra-bracket" />
              <code>(N - 1) * T_PWM / 2</code>
            </div>
          </div>
          <figcaption>
            {isZh
              ? "每 N 個 PWM 週期才更新 duty 時，duty command 被 hold 在 N*T_PWM 的視窗內；低頻下等效作用點約在視窗中心。扣掉 N=1 原本就存在的 T_PWM/2，額外延遲就是 (N - 1)*T_PWM/2。"
              : "When duty updates every N PWM cycles, the command is held across an N*T_PWM window. At low frequency, the equivalent action point is near the center. Subtract the N=1 baseline T_PWM/2 to get the extra delay: (N - 1)*T_PWM/2."}
          </figcaption>
        </figure>

        <figure className="system-flow-figure" aria-label={isZh ? "數位控制器整體系統流程圖" : "Digital controller system flow"}>
          <h3>{isZh ? "整個系統流程圖" : "Complete system flow"}</h3>
          <div className="system-flow-row">
            <div className="system-flow-node plant">
              <strong>{isZh ? "功率級" : "Power stage"}</strong>
              <span>G_p(s)</span>
            </div>
            <div className="system-flow-arrow feedback" />
            <div className="system-flow-node adc">
              <strong>ADC</strong>
              <span>{isZh ? "取樣 / 量化" : "sample / quantize"}</span>
            </div>
            <div className="system-flow-arrow" />
            <div className="system-flow-node compensator">
              <strong>G_c(z)</strong>
              <span>{isZh ? "IIR 補償器" : "IIR compensator"}</span>
            </div>
            <div className="system-flow-arrow" />
            <div className="system-flow-node clamp">
              <strong>Clamp</strong>
              <span>DUTY_MIN/MAX</span>
            </div>
            <div className="system-flow-arrow" />
            <div className="system-flow-node dpwm">
              <strong>DPWM</strong>
              <span>{isZh ? "解析度 / shadow load" : "resolution / shadow load"}</span>
            </div>
            <div className="system-flow-arrow" />
            <div className="system-flow-node pwm">
              <strong>PWM</strong>
              <span>{isZh ? "carrier delay" : "carrier delay"}</span>
            </div>
          </div>
          <figcaption>
            {isZh
              ? "小訊號迴路比較時，工具把 G_c(z)、PWM delay、功率級 G_p(s) 組成 T(z)，再計算含 delay 的 phase margin。"
              : "For small-signal loop comparison, the tool combines G_c(z), PWM delay, and G_p(s) into T(z), then recomputes delay-aware phase margin."}
          </figcaption>
        </figure>

        <figure className="digital-delay-figure" aria-label={isZh ? "數位控制器延遲流程圖" : "Digital controller delay flow"}>
          <div className="delay-flow-row">
            <div className="delay-flow-node sample">
              <strong>ADC</strong>
              <span>{isZh ? "取樣" : "sample"}</span>
            </div>
            <div className="delay-flow-segment compute">
              <span>
                {isZh ? "計算延遲" : "compute delay"}
                <small>COMPUTE_DELAY</small>
              </span>
            </div>
            <div className="delay-flow-node calc">
              <strong>IIR</strong>
              <span>{isZh ? "算 duty" : "duty calc"}</span>
            </div>
            <div className="delay-flow-segment output">
              <span>
                {isZh ? "輸出延遲" : "output delay"}
                <small>OUTPUT_DELAY</small>
              </span>
            </div>
            <div className="delay-flow-node pwm">
              <strong>PWM</strong>
              <span>{isZh ? "載入" : "load"}</span>
            </div>
            <div className="delay-flow-segment carrier">
              <span>
                {isZh ? "carrier delay" : "carrier delay"}
                <small>f_PWM + carrier type</small>
              </span>
            </div>
            <div className="delay-flow-node duty">
              <strong>DUTY</strong>
              <span>{isZh ? "生效" : "active"}</span>
            </div>
            <div className="delay-flow-segment update-hold">
              <span>
                {isZh ? "N 週期 hold" : "N-cycle hold"}
                <small>PWM_UPDATE_CYCLES</small>
              </span>
            </div>
          </div>
          <div className="delay-waveform" aria-hidden="true">
            <span className="wave-label">CLK</span>
            <div className="wave-line clock" />
            <span className="wave-label">PWM</span>
            <div className="wave-line pwm-wave" />
          </div>
          <figcaption>
            {isZh
              ? "總延遲 = 計算延遲 + 輸出延遲 + PWM modulator 等效延遲 + N 週期更新 hold delay；Bode 圖會把它轉成相位落後。"
              : "Total delay = compute delay + output delay + PWM modulator delay + N-cycle update hold delay; the Bode plot converts it into phase lag."}
          </figcaption>
        </figure>

        <section className="pwm-carrier-gallery" aria-label={isZh ? "PWM carrier type 圖示" : "PWM carrier type diagrams"}>
          <h3>{isZh ? "PWM carrier type 圖示" : "PWM carrier type diagrams"}</h3>
          <div className="pwm-carrier-grid">
            {pwmCarrierGuideItems.map((item) => (
              <article className={`pwm-carrier-card ${item.key}`} key={item.key}>
                <PwmCarrierMiniDiagram mode={item.key} />
                <strong>{item.title}</strong>
                <code>{item.formula}</code>
                <p>{isZh ? item.noteZh : item.noteEn}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="parameter-guide-grid">
          {parameters.map((parameter) => (
            <article className={`parameter-guide-card delay-impact-${parameter.delayImpact}`} key={parameter.key}>
              <h3>{parameter.title}</h3>
              <span className={`delay-impact-badge ${parameter.delayImpact}`}>
                {delayImpactText[parameter.delayImpact]}
              </span>
              {parameter.delayLink && <span className="delay-link-badge">{parameter.delayLink}</span>}
              <dl>
                <div>
                  <dt>{isZh ? "公式" : "Formula"}</dt>
                  <dd className="formula-list">
                    {parameter.formulas.map((formula) => (
                      <code key={formula}>{formula}</code>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>{isZh ? "影響" : "Affects"}</dt>
                  <dd>{parameter.affects}</dd>
                </div>
                <div>
                  <dt>{isZh ? "何時調整" : "Adjust when"}</dt>
                  <dd>{parameter.adjustWhen}</dd>
                </div>
                <div>
                  <dt>{isZh ? "何時不用動" : "Leave it when"}</dt>
                  <dd>{parameter.leaveWhen}</dd>
                </div>
                <div>
                  <dt>{isZh ? "例子" : "Example"}</dt>
                  <dd>{parameter.example}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </details>
  );
}

function PwmCarrierMiniDiagram({ mode }: { mode: PwmCarrierMode }) {
  return (
    <div className={`pwm-mini-diagram ${mode}`} aria-hidden="true">
      <div className="carrier-shape" />
      <div className="compare-level" />
      <div className="pulse-strip">
        <span />
        <span />
      </div>
    </div>
  );
}

function SimplisDllGuide({ locale, order }: { locale: Locale; order: number }) {
  const isZh = locale === "zh";
  return (
    <details className="calculation-steps simplis-dll-guide">
      <summary>
        <span>{isZh ? "SIMPLIS DLL 使用說明" : "SIMPLIS DLL Usage Guide"}</span>
        <small>
          {isZh
            ? "建立 C-Code DLL symbol、設定 pins/parameters，並把係數放進 action.c。"
            : "Create the C-Code DLL symbol, configure pins/parameters, and place coefficients in action.c."}
        </small>
      </summary>
      <div className="step-list">
        <article className="step-card" data-step="1">
          <h3>{isZh ? "建立 DLL project" : "Create the DLL project"}</h3>
          <p>
            {isZh
              ? "在 SIMPLIS 使用 C-Code DLL project generator 建立元件，產生 source 後主要修改 project_name_action.c。"
              : "Use the SIMPLIS C-Code DLL project generator, then edit project_name_action.c after the source files are generated."}
          </p>
        </article>
        <article className="step-card" data-step="2">
          <h3>{isZh ? "建議 pins" : "Recommended pins"}</h3>
          <div className="digital-guide-code">
            <code>Inputs: CLK, RESET, VFB, VREF</code>
            <code>Outputs: DUTY</code>
          </div>
        </article>
        <article className="step-card" data-step="3">
          <h3>{isZh ? "建議 parameters" : "Recommended parameters"}</h3>
          <div className="digital-guide-code">
            <code>{`B0..B${order}, A1..A${order}`}</code>
            <code>DUTY_MIN, DUTY_MAX, INITIAL_DUTY, OUTPUT_DELAY</code>
            <code>ADC_BITS, DPWM_BITS, FS</code>
          </div>
        </article>
        <article className="step-card" data-step="4">
          <h3>{isZh ? "action.c 更新流程" : "action.c update flow"}</h3>
          <p>
            {isZh
              ? "在 CLK rising edge 讀取 VFB/VREF，計算 e[n]，呼叫 digital_comp_step()，再將 duty ratio 轉成 DPWM code 寫到 DUTY bus。RESET 時清除 e/u history 並載入 INITIAL_DUTY。"
              : "On each CLK rising edge, read VFB/VREF, calculate e[n], call digital_comp_step(), convert duty ratio to a DPWM code, and write the DUTY bus. On RESET, clear e/u history and load INITIAL_DUTY."}
          </p>
        </article>
        <article className="step-card" data-step="5">
          <h3>{isZh ? "Type III 注意事項" : "Type III note"}</h3>
          <p>
            {isZh
              ? "完整 Tustin Type III 可能是三階 IIR。若係數表出現 B3/A3，SIMPLIS symbol 也要 expose 對應參數，或把控制器拆成 cascaded sections。"
              : "A full Tustin Type III can be third order. If B3/A3 appears, expose matching SIMPLIS parameters or split the controller into cascaded sections."}
          </p>
        </article>
      </div>
    </details>
  );
}

function formatSamplingPeriod(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return "Invalid";
  }
  if (Math.abs(seconds) < 1e-3) {
    return `${trimFixed(seconds * 1e6, 3)} us`;
  }
  if (Math.abs(seconds) < 1) {
    return `${trimFixed(seconds * 1e3, 3)} ms`;
  }
  return `${trimFixed(seconds, 4)} s`;
}

function trimFixed(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function LaTeXFormula({ latex }: { latex: string }) {
  return (
    <span
      className="latex-formula"
      dangerouslySetInnerHTML={{ __html: katex.renderToString(latex, { displayMode: true, throwOnError: false }) }}
    />
  );
}

function LaTeXInline({ latex }: { latex: string }) {
  return (
    <span
      className="latex-inline"
      dangerouslySetInnerHTML={{ __html: katex.renderToString(latex, { displayMode: false, throwOnError: false }) }}
    />
  );
}

function CalculationSteps({ result, locale }: { result: CompensatorResult; locale: Locale }) {
  const t = translations[locale];
  return (
    <details className="calculation-steps">
      <summary>
        <span>{t.calculationSteps}</span>
        <small>{t.calculationStepsHint}</small>
      </summary>
      <div className="step-list">
        <article className="step-card" data-step="1">
          <h3>Step 1 - <LaTeXInline latex="G_p(s)" /> at <LaTeXInline latex="f_C" /></h3>
          <p>
            Import <LaTeXInline latex="G_p(s)" />, then log-interpolate gain and phase at{" "}
            <LaTeXInline latex="f_C" /> = {formatFrequency(result.crossoverFrequency)}.
          </p>
          <div className="summary-strip compact">
            <Metric label="G_p gain" value={formatGainDb(result.plantGainDb)} />
            <Metric label="G_p phase" value={formatPhaseDeg(result.plantPhaseDeg)} />
          </div>
        </article>

        <article className="step-card" data-step="2">
          <h3>Step 2 - Required compensator gain and boost</h3>
          <div className="formula-expression equation-block compact-equation">
            <LaTeXFormula latex="G=\frac{1}{|G_p(f_C)|},\qquad \phi_{\mathrm{boost}}=PM_{\mathrm{TARGET}}-90^\circ-\angle G_p(f_C)" />
          </div>
          <div className="summary-strip compact">
            <Metric label="G" value={formatGainDb(20 * Math.log10(result.gainAtCrossover))} />
            <Metric label="Boost" value={formatPhaseDeg(result.requiredPhaseBoostDeg)} />
            <Metric
              label={result.compensatorType === "type1" ? "PM est" : "PM target"}
              value={
                result.targetPhaseMargin === null
                  ? formatPhaseDeg(result.estimatedPhaseMargin)
                  : formatPhaseDeg(result.targetPhaseMargin)
              }
            />
          </div>
        </article>

        <article className="step-card" data-step="3">
          <h3>Step 3 - k-factor and pole-zero placement</h3>
          <CompensatorPoleZeroEquations result={result} />
          <div className="zero-pole-list">
            {result.zeros.length === 0 && result.poles.length === 0 ? (
              <p>Type I integrator only</p>
            ) : (
              <>
                {result.zeros.map((zero, index) => (
                  <Metric key={`z-${index}`} label={`f_Z${index + 1}`} value={formatFrequency(zero)} />
                ))}
                {result.poles.map((pole, index) => (
                  <Metric key={`p-${index}`} label={`f_P${index + 1}`} value={formatFrequency(pole)} />
                ))}
              </>
            )}
          </div>
        </article>

        <article className="step-card" data-step="4">
          <h3>Step 4 - Component calculation and circuit</h3>
          <CompensatorTransferFunction type={result.compensatorType} />
          <CompensatorCircuitDiagram type={result.compensatorType} />
        </article>

        <article className="step-card" data-step="5">
          <h3>Step 5 - Loop gain margins</h3>
          <p>{t.crossoverGuide}</p>
          <div className="summary-strip compact">
            <Metric label={t.phaseMargin} value={formatOptionalPhase(result.stabilityMargins.phaseMarginDeg)} />
            <Metric label={t.gainMargin} value={formatOptionalGain(result.stabilityMargins.gainMarginDb)} />
            <Metric label="f_gc" value={formatOptionalFrequency(result.stabilityMargins.gainCrossoverFrequency)} />
            <Metric label="f_pc" value={formatOptionalFrequency(result.stabilityMargins.phaseCrossoverFrequency)} />
          </div>
        </article>
      </div>
    </details>
  );
}

function CompensatorTransferFunction({ type }: { type: CompensatorType }) {
  return (
    <div className="formula-list">
      <article className="formula-row">
        <div>
          <h3>{compensatorTypeLabels[type]}</h3>
          <div className="formula-expression equation-display equation-block">
            <TransferFunctionMath type={type} />
          </div>
        </div>
        <p>
          <EngineeringText text={transferFunctionDescription(type)} />
        </p>
      </article>
    </div>
  );
}

function TransferFunctionMath({ type }: { type: CompensatorType }) {
  if (type === "type1") {
    return <LaTeXFormula latex="G(s)=-G_0\frac{1}{s/\omega_{p0}}" />;
  }
  if (type === "type2") {
    return <LaTeXFormula latex="G(s)=-G_0\frac{1+s/\omega_z}{(s/\omega_z)(1+s/\omega_p)}" />;
  }
  return <LaTeXFormula latex="G(s)=-G_0\frac{(1+s/\omega_{z1})(1+s/\omega_{z2})}{(s/\omega_{z1})(1+s/\omega_{p1})(1+s/\omega_{p2})}" />;
}

function transferFunctionDescription(type: CompensatorType): string {
  if (type === "type1") {
    return "Type I contains only the origin pole integrator.";
  }
  if (type === "type2") {
    return "Type II contains one zero and one high-frequency pole around f_C.";
  }
  return "Type III contains two zeros and two high-frequency poles around f_C.";
}

function CompensatorPoleZeroEquations({ result }: { result: CompensatorResult }) {
  return (
    <div className="formula-list">
      <article className="formula-row">
        <div>
          <h3>{result.designMode === "manual" ? "Manual placement" : "Appendix 5B k-factor placement"}</h3>
          <div className="formula-expression equation-display equation-block">
            <PoleZeroMath type={result.compensatorType} />
          </div>
          <div className="formula-expression equation-display equation-block compact-equation">
            <ComponentPoleZeroMath type={result.compensatorType} />
          </div>
        </div>
        <div className="equation-readout">
          {result.originPoleFrequency && (
            <Metric label="f_p0" value={formatFrequency(result.originPoleFrequency)} />
          )}
          {result.zeros.map((zero, index) => (
            <Metric key={`eq-z-${index}`} label={`f_Z${index + 1}`} value={formatFrequency(zero)} />
          ))}
          {result.poles.map((pole, index) => (
            <Metric key={`eq-p-${index}`} label={`f_P${index + 1}`} value={formatFrequency(pole)} />
          ))}
        </div>
      </article>
    </div>
  );
}

function ComponentPoleZeroMath({ type }: { type: CompensatorType }) {
  if (type === "type1") {
    return <LaTeXFormula latex="f_{p0}=\frac{1}{2\pi R_1C_1}" />;
  }
  if (type === "type2") {
    return <LaTeXFormula latex="f_z=\frac{1}{2\pi R_2C_1},\qquad f_p=\frac{C_1+C_2}{2\pi R_2C_1C_2}" />;
  }
  return <LaTeXFormula latex="f_{z1}=\frac{1}{2\pi R_2C_1},\quad f_{p1}=\frac{C_1+C_2}{2\pi R_2C_1C_2},\quad f_{z2}=\frac{1}{2\pi (R_1+R_3)C_3},\quad f_{p2}=\frac{1}{2\pi R_3C_3}" />;
}

function PoleZeroMath({ type }: { type: CompensatorType }) {
  if (type === "type1") {
    return <LaTeXFormula latex="f_{p0}=Gf_C,\qquad C_1=\frac{1}{2\pi f_{p0}R_1}" />;
  }
  if (type === "type2") {
    return <LaTeXFormula latex="k=\tan\left(\frac{\phi_{\mathrm{boost}}}{2}+45^\circ\right),\qquad f_z=\frac{f_C}{k},\qquad f_p=f_Ck" />;
  }
  return <LaTeXFormula latex="k=\tan^2\left(\frac{\phi_{\mathrm{boost}}}{4}+45^\circ\right),\qquad f_{z1}=f_{z2}=\frac{f_C}{\sqrt{k}},\qquad f_{p1}=f_{p2}=f_C\sqrt{k}" />;
}

function CombinedBodePlot({ result, locale }: { result: CompensatorResult; locale: Locale }) {
  const t = translations[locale];
  const [showPlant, setShowPlant] = useState(true);
  const [showCompensator, setShowCompensator] = useState(true);
  const [showLoop, setShowLoop] = useState(true);
  if (result.loopGainBode.length < 2) {
    return <p className="message warning">No Bode data is available.</p>;
  }

  const magnitudeValues = [
    ...result.plantBode.map((point) => point.magnitudeDb),
    ...result.compensatorBode.map((point) => point.magnitudeDb),
    ...result.loopGainBode.map((point) => point.magnitudeDb),
  ].filter(Number.isFinite);
  const phaseValues = [
    ...result.plantBode.map((point) => point.phaseDeg),
    ...result.compensatorBode.map((point) => point.phaseDeg),
    ...result.loopGainBode.map((point) => point.phaseDeg),
  ].filter(Number.isFinite);
  const magMin = Math.min(...magnitudeValues);
  const magMax = Math.max(...magnitudeValues);
  const phaseMin = Math.min(...phaseValues);
  const phaseMax = Math.max(...phaseValues);
  const data: Data[] = [
    ...(showPlant ? bodeTraces("G<sub>p</sub>(s)", result.plantBode, "#0072bd") : []),
    ...(showCompensator ? bodeTraces("G<sub>c</sub>(s)", result.compensatorBode, "#d95319") : []),
    ...(showLoop ? bodeTraces("T(s)=G<sub>c</sub>(s)G<sub>p</sub>(s)", result.loopGainBode, "#77ac30") : []),
    ...poleZeroTraces(result, result.compensatorBode),
    ...crossoverLabelTraces(result, magMax + 8),
  ];
  const shapes = marginShapes(result);
  const layout: Partial<Layout> = {
    autosize: true,
    height: 730,
    margin: { l: 82, r: 34, t: 96, b: 76 },
    hovermode: "x unified",
    legend: { orientation: "h", x: 0.02, y: 1.12, yanchor: "bottom" },
    plot_bgcolor: "#ffffff",
    paper_bgcolor: "#ffffff",
    xaxis: {
      type: "log",
      domain: [0.08, 1],
      anchor: "y",
      matches: "x2",
      showticklabels: false,
      showgrid: true,
      gridcolor: "#d0d0d0",
      minor: { showgrid: true, gridcolor: "#e5e5e5" },
    },
    yaxis: {
      domain: [0.56, 1],
      title: { text: "Magnitude (dB)" },
      range: [magMin - 10, magMax + 16],
      zeroline: true,
      zerolinecolor: "#555555",
      showgrid: true,
      gridcolor: "#d0d0d0",
    },
    xaxis2: {
      type: "log",
      domain: [0.08, 1],
      anchor: "y2",
      matches: "x",
      title: { text: "Frequency (Hz)" },
      showgrid: true,
      gridcolor: "#d0d0d0",
      minor: { showgrid: true, gridcolor: "#e5e5e5" },
    },
    yaxis2: {
      domain: [0, 0.44],
      title: { text: "Phase (deg)" },
      range: [phaseMin - 20, phaseMax + 20],
      showgrid: true,
      gridcolor: "#d0d0d0",
    },
    shapes,
  };
  const config: Partial<Config> = {
    responsive: true,
    scrollZoom: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  };

  return (
    <div className="bode-plot-panel">
      <h3 className="bode-panel-title">Bode Diagram</h3>
      <div className="trace-toggles" aria-label={t.bodeDisplay}>
        <label><input type="checkbox" checked={showPlant} onChange={(event) => setShowPlant(event.target.checked)} /> <LaTeXInline latex="G_p(s)" /></label>
        <label><input type="checkbox" checked={showCompensator} onChange={(event) => setShowCompensator(event.target.checked)} /> <LaTeXInline latex="G_c(s)" /></label>
        <label><input type="checkbox" checked={showLoop} onChange={(event) => setShowLoop(event.target.checked)} /> T(s)</label>
      </div>
      <Plot className="plotly-bode-chart" data={data} layout={layout} config={config} useResizeHandler />
      <p className="chart-help">{t.crossoverGuide}</p>
      <div className="margin-panel">
        <Metric label={t.phaseMargin} value={formatOptionalPhase(result.stabilityMargins.phaseMarginDeg)} />
        <Metric label={t.gainMargin} value={formatOptionalGain(result.stabilityMargins.gainMarginDb)} />
        <Metric label={t.gainCrossover} value={formatOptionalFrequency(result.stabilityMargins.gainCrossoverFrequency)} />
        <Metric label={t.phaseCrossover} value={formatOptionalFrequency(result.stabilityMargins.phaseCrossoverFrequency)} />
      </div>
    </div>
  );
}

function bodeTraces(
  name: string,
  points: CompensatorBodePoint[],
  color: string,
  dash: "solid" | "dash" | "dot" = "solid",
): Data[] {
  const x = points.map((point) => point.frequency);
  const isLoop = name.includes("T(s)");
  return [
    {
      type: "scatter",
      mode: "lines",
      name,
      legendgroup: name,
      x,
      y: points.map((point) => point.magnitudeDb),
      xaxis: "x",
      yaxis: "y",
      line: { color, width: isLoop ? 2.4 : 1.7, dash },
      hovertemplate: `${name}<br>f=%{x:.4g} Hz<br>|G|=%{y:.3f} dB<extra></extra>`,
    },
    {
      type: "scatter",
      mode: "lines",
      name: `${name} phase`,
      legendgroup: name,
      showlegend: false,
      x,
      y: points.map((point) => point.phaseDeg),
      xaxis: "x2",
      yaxis: "y2",
      line: { color, width: isLoop ? 2.4 : 1.7, dash },
      hovertemplate: `${name}<br>f=%{x:.4g} Hz<br>phase=%{y:.3f} deg<extra></extra>`,
    },
  ] as Data[];
}

function poleZeroTraces(result: CompensatorResult, reference: CompensatorBodePoint[]): Data[] {
  const zeros = result.zeros.map((frequency, index) => ({ frequency, label: `Z${index + 1}` }));
  const poles = result.poles.map((frequency, index) => ({ frequency, label: `P${index + 1}` }));
  const zeroPoints = spreadPoleZeroLabels(
    zeros.map((item) => ({ ...item, point: nearestBodePoint(reference, item.frequency) })),
    3.5,
  );
  const polePoints = spreadPoleZeroLabels(
    poles.map((item) => ({ ...item, point: nearestBodePoint(reference, item.frequency) })),
    -3.5,
  );
  return [
    {
      type: "scatter",
      mode: "markers",
      name: "Zeros",
      x: zeroPoints.map((item) => item.frequency),
      y: zeroPoints.map((item) => item.point.magnitudeDb),
      xaxis: "x",
      yaxis: "y",
      marker: { symbol: "circle-open", size: 12, color: "#0b6b5f", line: { width: 2 } },
      text: zeroPoints.map((item) => item.label),
      hovertemplate: "Zero %{text}<br>f=%{x:.4g} Hz<extra></extra>",
    },
    {
      type: "scatter",
      mode: "text",
      name: "Zero labels",
      showlegend: false,
      x: zeroPoints.map((item) => item.frequency),
      y: zeroPoints.map((item) => item.y),
      text: zeroPoints.map((item) => item.label),
      textposition: zeroPoints.map((item) => item.textposition),
      xaxis: "x",
      yaxis: "y",
      textfont: { color: "#0b6b5f", size: 12 },
      hoverinfo: "skip",
    },
    {
      type: "scatter",
      mode: "markers",
      name: "Poles",
      x: polePoints.map((item) => item.frequency),
      y: polePoints.map((item) => item.point.magnitudeDb),
      xaxis: "x",
      yaxis: "y",
      marker: { symbol: "x", size: 12, color: "#9a241b", line: { width: 2 } },
      text: polePoints.map((item) => item.label),
      hovertemplate: "Pole %{text}<br>f=%{x:.4g} Hz<extra></extra>",
    },
    {
      type: "scatter",
      mode: "text",
      name: "Pole labels",
      showlegend: false,
      x: polePoints.map((item) => item.frequency),
      y: polePoints.map((item) => item.y),
      text: polePoints.map((item) => item.label),
      textposition: polePoints.map((item) => item.textposition),
      xaxis: "x",
      yaxis: "y",
      textfont: { color: "#9a241b", size: 12 },
      hoverinfo: "skip",
    },
  ] as Data[];
}

function crossoverLabelTraces(result: CompensatorResult, labelY: number): Data[] {
  const { gainCrossoverFrequency, phaseCrossoverFrequency } = result.stabilityMargins;
  const traces: Data[] = [];
  if (gainCrossoverFrequency) {
    traces.push({
      type: "scatter",
      mode: "text",
      name: "f_gc label",
      showlegend: false,
      x: [gainCrossoverFrequency],
      y: [labelY],
      text: [`f<sub>gc</sub><br>${formatFrequency(gainCrossoverFrequency)}`],
      textposition: "top center",
      xaxis: "x",
      yaxis: "y",
      textfont: { color: "#7e2f8e", size: 13 },
      hoverinfo: "skip",
    } as Data);
  }
  if (phaseCrossoverFrequency) {
    traces.push({
      type: "scatter",
      mode: "text",
      name: "f_pc label",
      showlegend: false,
      x: [phaseCrossoverFrequency],
      y: [labelY - 8],
      text: [`f<sub>pc</sub><br>${formatFrequency(phaseCrossoverFrequency)}`],
      textposition: "top center",
      xaxis: "x",
      yaxis: "y",
      textfont: { color: "#a2142f", size: 13 },
      hoverinfo: "skip",
    } as Data);
  }
  return traces;
}

function spreadPoleZeroLabels(
  items: Array<{ frequency: number; label: string; point: CompensatorBodePoint }>,
  stepDb: number,
): Array<{ frequency: number; label: string; point: CompensatorBodePoint; y: number; textposition: string }> {
  const counts = new Map<string, number>();
  return items.map((item) => {
    const key = item.frequency.toPrecision(8);
    const order = counts.get(key) ?? 0;
    counts.set(key, order + 1);
    const centeredOffset = order === 0 ? stepDb : stepDb * (order + 1.35);
    return {
      ...item,
      y: item.point.magnitudeDb + centeredOffset,
      textposition: stepDb > 0 ? (order % 2 === 0 ? "top center" : "top right") : (order % 2 === 0 ? "bottom center" : "bottom right"),
    };
  });
}

function nearestBodePoint(points: CompensatorBodePoint[], frequency: number): CompensatorBodePoint {
  return points.reduce((best, point) =>
    Math.abs(Math.log10(point.frequency) - Math.log10(frequency)) <
      Math.abs(Math.log10(best.frequency) - Math.log10(frequency))
      ? point
      : best,
  );
}

function marginShapes(result: CompensatorResult): Partial<Shape>[] {
  const shapes: Partial<Shape>[] = [
    {
      type: "line",
      xref: "paper",
      yref: "y",
      x0: 0.08,
      x1: 1,
      y0: 0,
      y1: 0,
      line: { color: "#555555", width: 1, dash: "dot" },
    },
    {
      type: "line",
      xref: "paper",
      yref: "y2",
      x0: 0.08,
      x1: 1,
      y0: -180,
      y1: -180,
      line: { color: "#555555", width: 1, dash: "dot" },
    },
  ];
  const { gainCrossoverFrequency, phaseCrossoverFrequency } = result.stabilityMargins;
  if (gainCrossoverFrequency) {
    shapes.push({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: gainCrossoverFrequency,
      x1: gainCrossoverFrequency,
      y0: 0,
      y1: 1,
      line: { color: "#7e2f8e", width: 1.6, dash: "dash" },
    });
  }
  if (phaseCrossoverFrequency) {
    shapes.push({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: phaseCrossoverFrequency,
      x1: phaseCrossoverFrequency,
      y0: 0,
      y1: 1,
      line: { color: "#a2142f", width: 1.6, dash: "dash" },
    });
  }
  return shapes;
}

function formatOptionalFrequency(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "N/A" : formatFrequency(value);
}

function formatOptionalGain(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "N/A" : formatGainDb(value);
}

function formatOptionalPhase(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "N/A" : formatPhaseDeg(value);
}

function EngineeringText({ text }: { text: string }) {
  const parts = text.split(/([A-Za-z]+(?:_[A-Za-z0-9()]+|[0-9]+)?)/g);
  return (
    <>
      {parts.map((part, index) => {
        const symbol = parseEngineeringSymbol(part);
        if (!symbol) {
          return part;
        }
        return (
          <span key={`${part}-${index}`} className="eng-symbol">
            <i>{symbol.base}</i>
            {symbol.sub && <sub>{symbol.sub}</sub>}
          </span>
        );
      })}
    </>
  );
}

function parseEngineeringSymbol(text: string): { base: string; sub?: string } | null {
  const underscore = /^([A-Za-z]+)_([A-Za-z0-9()]+)$/.exec(text);
  if (underscore) {
    return { base: underscore[1], sub: underscore[2] };
  }
  const numbered = /^([A-Za-z])([0-9]+)$/.exec(text);
  if (numbered) {
    return { base: numbered[1], sub: numbered[2] };
  }
  if (/^[A-Za-z]$/.test(text)) {
    return { base: text };
  }
  return null;
}

function CompensatorCircuitDiagram({ type }: { type: CompensatorType }) {
  const src = type === "type1" ? type1Circuit : type === "type2" ? type2Circuit : type3Circuit;
  return (
    <div className="circuit-diagram" role="img" aria-label={`${compensatorTypeLabels[type]} circuit`}>
      <img src={src} alt={`${compensatorTypeLabels[type]} compensator circuit`} />
    </div>
  );
}

function Resistor({ x, y, label }: { x: number; y: number; label: string }) {
  const points = [
    [x, y],
    [x + 10, y - 12],
    [x + 22, y + 12],
    [x + 34, y - 12],
    [x + 46, y + 12],
    [x + 58, y - 12],
    [x + 70, y + 12],
    [x + 80, y],
  ]
    .map((point) => point.join(","))
    .join(" ");
  return (
    <>
      <polyline points={points} />
      <text x={x + 28} y={y - 24}>{label}</text>
    </>
  );
}

function Capacitor({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <>
      <line x1={x - 34} y1={y} x2={x - 8} y2={y} />
      <line x1={x - 8} y1={y - 22} x2={x - 8} y2={y + 22} />
      <line x1={x + 8} y1={y - 22} x2={x + 8} y2={y + 22} />
      <line x1={x + 8} y1={y} x2={x + 34} y2={y} />
      <text x={x - 13} y={y - 32}>{label}</text>
    </>
  );
}

function Ground({ x, y }: { x: number; y: number }) {
  return (
    <>
      <line x1={x} y1={y - 6} x2={x} y2={y + 8} />
      <line x1={x - 18} y1={y + 8} x2={x + 18} y2={y + 8} />
      <line x1={x - 12} y1={y + 16} x2={x + 12} y2={y + 16} />
      <line x1={x - 6} y1={y + 24} x2={x + 6} y2={y + 24} />
    </>
  );
}

function ResultPanel({
  result,
  locale,
  dirty,
}: {
  result: CalculationResult;
  locale: Locale;
  dirty: boolean;
}) {
  const dangerCount = result.messages.filter((message) => message.severity === "danger").length;
  const t = translations[locale];
  return (
    <section className="result-panel">
      {dirty && <div className="status warning">{t.staleNotice}</div>}
      <div className="summary-strip">
        <Metric label="C_BOOT min" value={formatCapacitance(result.minimumCboot)} />
        <Metric label="C_BOOT rec" value={formatCapacitance(result.recommendedCboot)} />
        <Metric
          label="Margin"
          value={result.selectedMargin ? `${result.selectedMargin.toFixed(2)}x` : "N/A"}
        />
        <Metric
          label="C_VDD min"
          value={result.cvddMinimum ? formatCapacitance(result.cvddMinimum) : "N/A"}
        />
      </div>

      <div className={dangerCount > 0 ? "status danger" : "status ok"}>
        {dangerCount > 0 ? `${dangerCount} ${t.critical}` : t.noCritical}
      </div>

      <section className="formula-panel">
        <h2>{t.formulaTrace}</h2>
        <div className="formula-list">
          {result.lines.map((line) => (
            <article key={`${line.label}-${line.expression}`} className="formula-row">
              <div>
                <h3>{line.label}</h3>
                <div className="formula-expression">
                  <EngineeringFormula expression={line.expression} />
                </div>
              </div>
              <p>{line.result}</p>
            </article>
          ))}
        </div>
      </section>

      <ProcurementPanel result={result} locale={locale} />

      <section className="message-panel">
        <h2>{t.designNotes}</h2>
        <div className="message-list">
          {result.messages.map((message, index) => (
            <p key={`${message.text}-${index}`} className={`message ${message.severity}`}>
              {message.text}
            </p>
          ))}
          <p className="message info">{t.guidance}</p>
          {result.selectedMargin && (
            <p className="message info">
              {t.marginPrefix} {formatPercent(result.selectedMargin - 1)}
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

function EngineeringFormula({ expression }: { expression: string }) {
  switch (expression) {
    case "C_G = Q_G / (V_DD - V_D)":
      return (
        <MathBlock>
          <Sym name="C" sub="G" />
          <Mo>=</Mo>
          <Frac>
            <Sym name="Q" sub="G" />
            <MRow>
              <Sym name="V" sub="DD" />
              <Mo>-</Mo>
              <Sym name="V" sub="D" />
            </MRow>
          </Frac>
        </MathBlock>
      );
    case "C_BOOT >= 10 x C_G":
      return (
        <MathBlock>
          <Sym name="C" sub="BOOT" />
          <Mo>&ge;</Mo>
          <Mn>10</Mn>
          <Mo>&times;</Mo>
          <Sym name="C" sub="G" />
        </MathBlock>
      );
    case "Q_TOTAL = Q_G + I_HBS x D_MAX / f_SW + I_HB / f_SW":
      return (
        <MathBlock>
          <Sym name="Q" sub="TOTAL" />
          <Mo>=</Mo>
          <Sym name="Q" sub="G" />
          <Mo>+</Mo>
          <Frac>
            <MRow>
              <Sym name="I" sub="HBS" />
              <Mo>&times;</Mo>
              <Sym name="D" sub="MAX" />
            </MRow>
            <Sym name="f" sub="SW" />
          </Frac>
          <Mo>+</Mo>
          <Frac>
            <Sym name="I" sub="HB" />
            <Sym name="f" sub="SW" />
          </Frac>
        </MathBlock>
      );
    case "Delta V_HB = V_DD - V_DH - V_HBL":
      return (
        <MathBlock>
          <Mo>&Delta;</Mo>
          <Sym name="V" sub="HB" />
          <Mo>=</Mo>
          <Sym name="V" sub="DD" />
          <Mo>-</Mo>
          <Sym name="V" sub="DH" />
          <Mo>-</Mo>
          <Sym name="V" sub="HBL" />
        </MathBlock>
      );
    case "C_BOOT >= Q_TOTAL / Delta V_HB":
      return (
        <MathBlock>
          <Sym name="C" sub="BOOT" />
          <Mo>&ge;</Mo>
          <Frac>
            <Sym name="Q" sub="TOTAL" />
            <MRow>
              <Mo>&Delta;</Mo>
              <Sym name="V" sub="HB" />
            </MRow>
          </Frac>
        </MathBlock>
      );
    case "Delta V_BOOT = V_DD - V_F - V_GS(MIN)":
      return (
        <MathBlock>
          <Mo>&Delta;</Mo>
          <Sym name="V" sub="BOOT" />
          <Mo>=</Mo>
          <Sym name="V" sub="DD" />
          <Mo>-</Mo>
          <Sym name="V" sub="F" />
          <Mo>-</Mo>
          <Sym name="V" sub="GS(MIN)" />
        </MathBlock>
      );
    case "I_LEAK = I_LKCAP + I_LKGS + I_QBS + I_LK + I_LKDIODE":
      return (
        <MathBlock>
          <Sym name="I" sub="LEAK" />
          <Mo>=</Mo>
          <Sym name="I" sub="LKCAP" />
          <Mo>+</Mo>
          <Sym name="I" sub="LKGS" />
          <Mo>+</Mo>
          <Sym name="I" sub="QBS" />
          <Mo>+</Mo>
          <Sym name="I" sub="LK" />
          <Mo>+</Mo>
          <Sym name="I" sub="LKDIODE" />
        </MathBlock>
      );
    case "Q_TOTAL = Q_GATE + I_LEAK x t_ON + Q_LS":
      return (
        <MathBlock>
          <Sym name="Q" sub="TOTAL" />
          <Mo>=</Mo>
          <Sym name="Q" sub="GATE" />
          <Mo>+</Mo>
          <Sym name="I" sub="LEAK" />
          <Mo>&times;</Mo>
          <Sym name="t" sub="ON" />
          <Mo>+</Mo>
          <Sym name="Q" sub="LS" />
        </MathBlock>
      );
    case "C_BOOT = Q_TOTAL / Delta V_BOOT":
      return (
        <MathBlock>
          <Sym name="C" sub="BOOT" />
          <Mo>=</Mo>
          <Frac>
            <Sym name="Q" sub="TOTAL" />
            <MRow>
              <Mo>&Delta;</Mo>
              <Sym name="V" sub="BOOT" />
            </MRow>
          </Frac>
        </MathBlock>
      );
    case "T_S = 1 / f_SW":
      return (
        <MathBlock>
          <Sym name="T" sub="S" />
          <Mo>=</Mo>
          <Frac>
            <Mn>1</Mn>
            <Sym name="f" sub="SW" />
          </Frac>
        </MathBlock>
      );
    case "V_RBOOT = ((Q_G* x f_SW + I_LEAK) / D) x R_BOOT":
      return (
        <MathBlock>
          <Sym name="V" sub="RBOOT" />
          <Mo>=</Mo>
          <Frac>
            <MRow>
              <Sym name="Q" sub="G" sup="*" />
              <Mo>&times;</Mo>
              <Sym name="f" sub="SW" />
              <Mo>+</Mo>
              <Sym name="I" sub="LEAK" />
            </MRow>
            <Mi>D</Mi>
          </Frac>
          <Mo>&times;</Mo>
          <Sym name="R" sub="BOOT" />
        </MathBlock>
      );
    case "Q_TOTAL = Q_G* + I_LEAK x (1 - D) x T_S":
      return (
        <MathBlock>
          <Sym name="Q" sub="TOTAL" />
          <Mo>=</Mo>
          <Sym name="Q" sub="G" sup="*" />
          <Mo>+</Mo>
          <Sym name="I" sub="LEAK" />
          <Mo>&times;</Mo>
          <MRow>
            <Mo>(</Mo>
            <Mn>1</Mn>
            <Mo>-</Mo>
            <Mi>D</Mi>
            <Mo>)</Mo>
          </MRow>
          <Mo>&times;</Mo>
          <Sym name="T" sub="S" />
        </MathBlock>
      );
    case "Delta V_BS = Q_TOTAL / C_BOOT":
      return (
        <MathBlock>
          <Mo>&Delta;</Mo>
          <Sym name="V" sub="BS" />
          <Mo>=</Mo>
          <Frac>
            <Sym name="Q" sub="TOTAL" />
            <Sym name="C" sub="BOOT" />
          </Frac>
        </MathBlock>
      );
    case "V_DROP = V_RBOOT + Delta V_BS / 2":
      return (
        <MathBlock>
          <Sym name="V" sub="DROP" />
          <Mo>=</Mo>
          <Sym name="V" sub="RBOOT" />
          <Mo>+</Mo>
          <Frac>
            <MRow>
              <Mo>&Delta;</Mo>
              <Sym name="V" sub="BS" />
            </MRow>
            <Mn>2</Mn>
          </Frac>
        </MathBlock>
      );
    case "D_MIN = ((Q_G* x f_SW + I_LEAK) x R_BOOT) / V_DROP_LIMIT":
      return (
        <MathBlock>
          <Sym name="D" sub="MIN" />
          <Mo>=</Mo>
          <Frac>
            <MRow>
              <Mo>(</Mo>
              <Sym name="Q" sub="G" sup="*" />
              <Mo>&times;</Mo>
              <Sym name="f" sub="SW" />
              <Mo>+</Mo>
              <Sym name="I" sub="LEAK" />
              <Mo>)</Mo>
              <Mo>&times;</Mo>
              <Sym name="R" sub="BOOT" />
            </MRow>
            <Sym name="V" sub="DROP_LIMIT" />
          </Frac>
        </MathBlock>
      );
    case "C_BOOT >= Q_TOTAL / (2 x (V_DROP_LIMIT - V_RBOOT))":
      return (
        <MathBlock>
          <Sym name="C" sub="BOOT" />
          <Mo>&ge;</Mo>
          <Frac>
            <Sym name="Q" sub="TOTAL" />
            <MRow>
              <Mn>2</Mn>
              <Mo>&times;</Mo>
              <Mo>(</Mo>
              <Sym name="V" sub="DROP_LIMIT" />
              <Mo>-</Mo>
              <Sym name="V" sub="RBOOT" />
              <Mo>)</Mo>
            </MRow>
          </Frac>
        </MathBlock>
      );
    case "inputs = f_C, G, boost, R1":
      return (
        <MathBlock>
          <MRow>
            <Sym name="f" sub="C" />
            <Mo>,</Mo>
            <Mi>G</Mi>
            <Mo>,</Mo>
            <Mi>boost</Mi>
            <Mo>,</Mo>
            <Sym name="R" sub="1" />
          </MRow>
        </MathBlock>
      );
    case "C1 = 1 / (2pi x f_C x R1 x G)":
      return (
        <MathBlock>
          <Sym name="C" sub="1" />
          <Mo>=</Mo>
          <Frac>
            <Mn>1</Mn>
            <MRow>
              <Mn>2</Mn>
              <Mi>pi</Mi>
              <Sym name="f" sub="C" />
              <Sym name="R" sub="1" />
              <Mi>G</Mi>
            </MRow>
          </Frac>
        </MathBlock>
      );
    case "k = tan(PHI_BOOST / n + 45deg)":
      return (
        <MathBlock>
          <Mi>k</Mi>
          <Mo>=</Mo>
          <Mi>tan</Mi>
          <MRow>
            <Mo>(</Mo>
            <Frac>
              <Sym name="PHI" sub="BOOST" />
              <Mi>n</Mi>
            </Frac>
            <Mo>+</Mo>
            <Mn>45</Mn>
            <Mo>&deg;</Mo>
            <Mo>)</Mo>
          </MRow>
        </MathBlock>
      );
    case "f_Z = f_C / k, f_P = f_C x k":
      return (
        <MathBlock>
          <Sym name="f" sub="Z" />
          <Mo>=</Mo>
          <Frac>
            <Sym name="f" sub="C" />
            <Mi>k</Mi>
          </Frac>
          <Mo>,</Mo>
          <Sym name="f" sub="P" />
          <Mo>=</Mo>
          <Sym name="f" sub="C" />
          <Mo>&times;</Mo>
          <Mi>k</Mi>
        </MathBlock>
      );
    case "f_Z = f_C / sqrt(alpha), f_P = f_C x sqrt(alpha)":
      return (
        <MathBlock>
          <Sym name="f" sub="Z" />
          <Mo>=</Mo>
          <Frac>
            <Sym name="f" sub="C" />
            <MRow>
              <Mo>&radic;</Mo>
              <Mi>alpha</Mi>
            </MRow>
          </Frac>
          <Mo>,</Mo>
          <Sym name="f" sub="P" />
          <Mo>=</Mo>
          <Sym name="f" sub="C" />
          <Mo>&times;</Mo>
          <Mo>&radic;</Mo>
          <Mi>alpha</Mi>
        </MathBlock>
      );
    default:
      return <span>{expression}</span>;
  }
}

function MathBlock({ children }: { children: ReactNode }) {
  return createElement(
    "math",
    { display: "block", className: "math-formula" },
    createElement("mrow", null, children),
  );
}

function Frac({ children }: { children: [ReactNode, ReactNode] }) {
  return createElement("mfrac", null, children);
}

function Sym({
  name,
  sub,
  sup,
}: {
  name: string;
  sub?: string;
  sup?: string;
}) {
  const base = createElement("mi", null, name);
  if (sub && sup) {
    return createElement(
      "msubsup",
      null,
      base,
      createElement("mtext", null, sub),
      createElement("mtext", null, sup),
    );
  }
  if (sub) {
    return createElement(
      "msub",
      null,
      base,
      createElement("mtext", null, sub),
    );
  }
  return base;
}

function Omega({ sub }: { sub: string }) {
  return createElement(
    "msub",
    null,
    createElement("mi", null, "ω"),
    createElement("mtext", null, sub),
  );
}

function MRow({ children }: { children: ReactNode }) {
  return createElement("mrow", null, children);
}

function Mo({ children }: { children: ReactNode }) {
  return createElement("mo", { stretchy: "false" }, children);
}

function Mi({ children }: { children: ReactNode }) {
  return createElement("mi", null, children);
}

function Mn({ children }: { children: ReactNode }) {
  return createElement("mn", null, children);
}

function ProcurementPanel({
  result,
  locale,
}: {
  result: CalculationResult;
  locale: Locale;
}) {
  const t = translations[locale];
  const query = encodeURIComponent(result.procurement.searchQuery);
  const digiKeyUrl = `https://www.digikey.com/en/products?keywords=${query}`;
  const mouserUrl = `https://www.mouser.com/c/?q=${query}`;
  return (
    <section className="procurement-panel">
      <h2>{t.procurement}</h2>
      <p>{t.procurementNote}</p>
      <div className="procurement-grid">
        <Metric label={t.value} value={result.procurement.value} />
        <Metric label={t.voltage} value={result.procurement.voltageRating} />
        <Metric label={t.dielectric} value={result.procurement.dielectric} />
        <Metric label={t.tolerance} value={result.procurement.tolerance} />
      </div>
      <p className="package-hint">
        <strong>{t.packageHint}:</strong> {result.procurement.packageHint}
      </p>
      <div className="shopping-links">
        <a href={digiKeyUrl} target="_blank" rel="noreferrer">
          {t.searchDigiKey}
        </a>
        <a href={mouserUrl} target="_blank" rel="noreferrer">
          {t.searchMouser}
        </a>
      </div>
      <ul>
        {result.procurement.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

function ReferencePanel({ locale }: { locale: Locale }) {
  const t = translations[locale];
  return (
    <aside className="reference-panel" aria-label="Reference material">
      <h2>{t.references}</h2>
      <p>{t.referencesNote}</p>
      <div className="reference-list">
        {sourceLinks.map((source) => (
          <a key={source.href} href={source.href} target="_blank" rel="noreferrer">
            <span>{source.vendor}</span>
            <strong>{source.label}</strong>
            <small>{source.note}</small>
          </a>
        ))}
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>
        <EngineeringText text={label} />
      </span>
      <strong>{value}</strong>
    </div>
  );
}
