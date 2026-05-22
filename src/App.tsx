import { createElement, useState } from "react";
import type { ReactNode } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import type { Config, Data, Layout, Shape } from "plotly.js";
import PlotlyBasic from "plotly.js-basic-dist-min";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  Calculator,
  CircuitBoard,
  Download,
  FileCode2,
  FileText,
  Gauge,
  Languages,
  Play,
  RotateCcw,
  SlidersHorizontal,
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
  SimetrixComponent,
  SimetrixScriptOptions,
  SimetrixSweepMode,
  countSimetrixRuns,
  generateSimetrixSweepScript,
  normalizeModelList,
  parseSimetrixNetlist,
} from "./lib/simetrixScriptGenerator";
import {
  VerilogAModel,
  VerilogAModelId,
  formatVerilogAParameterAssignments,
  getVerilogAModel,
  verilogAModels,
} from "./lib/verilogAModelLibrary";
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
type FeatureId = "bootstrap" | "compensator" | "simetrix" | "verilog-a";

type UnitOption = {
  label: string;
  factor: number;
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

const featureIcons: Record<FeatureId | "gate" | "rc" | "loss", LucideIcon> = {
  bootstrap: Calculator,
  compensator: Gauge,
  simetrix: FileCode2,
  "verilog-a": FileText,
  gate: SlidersHorizontal,
  rc: CircuitBoard,
  loss: Zap,
};

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
};

const translations = {
  zh: {
    eyebrow: "高側閘極驅動設計",
    title: "Bootstrap 電容計算器",
    subtitle:
      "依 TI、onsemi、Infineon 參考資料分別計算 high-side bootstrap 電容，保留完整公式代入流程與設計警告。",
    compensatorEyebrow: "電源迴路設計",
    compensatorTitle: "補償器計算器",
    compensatorSubtitle:
      "匯入 power stage Bode plot，依 Chapter 5 非隔離 op amp 補償器與 Appendix 5B k-factor 方法計算 Type I/II/III 元件。",
    simetrixEyebrow: "SIMetrix 自動化",
    simetrixTitle: "開關 Model Sweep 腳本產生器",
    simetrixSubtitle:
      "匯入 SIMetrix netlist，自動偵測 Q/M/S/X 開關候選元件，輸入待比較 model 後產生損耗分析用 .sxscr 腳本。",
    verilogAEyebrow: "行為模型庫",
    verilogATitle: "Verilog-A 功能模型",
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
      bootstrap: "Bootstrap 電容",
      compensator: "補償器計算",
      simetrix: "SIMetrix 腳本",
      "verilog-a": "Verilog-A 模型",
      gate: "閘極電阻",
      rc: "RC 濾波",
      loss: "功耗計算",
    },
  },
  en: {
    eyebrow: "High-side gate driver design",
    title: "Bootstrap Capacitor Calculator",
    subtitle:
      "Calculate high-side bootstrap capacitance with TI, onsemi, and Infineon methods, including formula trace and design warnings.",
    compensatorEyebrow: "Power-loop design",
    compensatorTitle: "Compensator Calculator",
    compensatorSubtitle:
      "Import a power-stage Bode plot, then calculate Type I/II/III non-isolated op amp compensator parts with Chapter 5 and Appendix 5B k-factor equations.",
    simetrixEyebrow: "SIMetrix automation",
    simetrixTitle: "Switch Model Sweep Script Generator",
    simetrixSubtitle:
      "Import a SIMetrix netlist, detect likely Q/M/S/X switching instances, enter model names, and generate a loss-analysis .sxscr sweep script.",
    verilogAEyebrow: "Behavioral model library",
    verilogATitle: "Verilog-A Function Models",
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
      bootstrap: "Bootstrap capacitor",
      compensator: "Compensator calculator",
      simetrix: "SIMetrix script",
      "verilog-a": "Verilog-A models",
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
  if (feature === "verilog-a") {
    return {
      eyebrow: t.verilogAEyebrow,
      title: t.verilogATitle,
      subtitle: t.verilogASubtitle,
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
  const [verilogAModelId, setVerilogAModelId] = useState<VerilogAModelId>("deadtime-generator");
  const activeValues = values[method];
  const activeUnits = units[method];
  const t = translations[locale];
  const featureHeader = getFeatureHeader(feature, locale);
  const BootstrapIcon = featureIcons.bootstrap;
  const CompensatorIcon = featureIcons.compensator;
  const SimetrixIcon = featureIcons.simetrix;
  const VerilogAIcon = featureIcons["verilog-a"];
  const GateIcon = featureIcons.gate;
  const RcIcon = featureIcons.rc;
  const LossIcon = featureIcons.loss;

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

  function updateCompUnit(key: string, nextUnit: string) {
    const oldUnit = compUnits[key];
    const siValue = toSi(compValues[key], oldUnit);
    const nextValue = fromSi(siValue, nextUnit);
    setCompUnits((current) => ({ ...current, [key]: nextUnit }));
    setCompValues((current) => ({ ...current, [key]: Number(nextValue.toPrecision(8)) }));
    setCompAnalysisDirty(true);
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
          <strong>Tool</strong>
        </div>
        <nav>
          <button
            className={feature === "bootstrap" ? "active" : ""}
            type="button"
            onClick={() => setFeature("bootstrap")}
          >
            <BootstrapIcon aria-hidden="true" size={18} />
            {t.features.bootstrap}
          </button>
          <button
            className={feature === "compensator" ? "active" : ""}
            type="button"
            onClick={() => setFeature("compensator")}
          >
            <CompensatorIcon aria-hidden="true" size={18} />
            {t.features.compensator}
          </button>
          <button
            className={feature === "simetrix" ? "active" : ""}
            type="button"
            onClick={() => setFeature("simetrix")}
          >
            <SimetrixIcon aria-hidden="true" size={18} />
            {t.features.simetrix}
          </button>
          <button
            className={feature === "verilog-a" ? "active" : ""}
            type="button"
            onClick={() => setFeature("verilog-a")}
          >
            <VerilogAIcon aria-hidden="true" size={18} />
            {t.features["verilog-a"]}
          </button>
          <button type="button" disabled>
            <GateIcon aria-hidden="true" size={18} />
            {t.features.gate}
          </button>
          <button type="button" disabled>
            <RcIcon aria-hidden="true" size={18} />
            {t.features.rc}
          </button>
          <button type="button" disabled>
            <LossIcon aria-hidden="true" size={18} />
            {t.features.loss}
          </button>
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
          <CompensatorResultPanel result={analysis} locale={locale} dirty={analysisDirty} />
        ) : (
          <PendingPanel locale={locale} />
        )}
      </section>
    </>
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
  const dangerCount = result.messages.filter((message) => message.severity === "danger").length;
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

function bodeTraces(name: string, points: CompensatorBodePoint[], color: string): Data[] {
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
      line: { color, width: isLoop ? 2.4 : 1.7 },
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
      line: { color, width: isLoop ? 2.4 : 1.7 },
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
