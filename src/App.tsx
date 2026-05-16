import { createElement, useState } from "react";
import type { ReactNode } from "react";
import {
  CalculationResult,
  MethodId,
  calculateInfineon,
  calculateOnsemi,
  calculateTi,
} from "./lib/bootstrapCalculator";
import {
  formatCapacitance,
  formatPercent,
} from "./lib/units";

type NumericState = Record<string, number>;
type UnitState = Record<string, string>;
type Locale = "zh" | "en";

type UnitOption = {
  label: string;
  factor: number;
};

const methodLabels: Record<MethodId, string> = {
  ti: "TI Integrated",
  onsemi: "onsemi AN-6076",
  infineon: "Infineon Network Analysis",
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
};

const translations = {
  zh: {
    eyebrow: "高側閘極驅動設計",
    title: "Bootstrap 電容計算器",
    subtitle:
      "依 TI、onsemi、Infineon 參考資料分別計算 high-side bootstrap 電容，保留完整公式代入流程與設計警告。",
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
    pendingTitle: "尚未執行分析",
    pendingBody: "設定參數後按下執行分析，工具才會計算 bootstrap 電容、公式推導與推薦料件。",
    staleNotice: "參數已變更，請重新執行分析以更新結果。",
    guidance:
      "此工具提供工程估算與公式追溯，最終仍需依 gate driver、MOSFET、diode、電容 DC bias、layout 與實測波形確認。",
    marginPrefix: "目前選用電容比計算最小值高出",
    features: {
      bootstrap: "Bootstrap 電容",
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
    pendingTitle: "Analysis has not run yet",
    pendingBody: "Set the parameters, then run analysis to calculate bootstrap capacitance, formula trace, and recommended parts.",
    staleNotice: "Parameters changed. Run analysis again to update the result.",
    guidance:
      "Engineering guidance only. Verify final values with gate-driver limits, MOSFET data, diode stress, capacitor DC bias, layout, and measured waveforms.",
    marginPrefix: "Selected capacitance margin above calculated minimum:",
    features: {
      bootstrap: "Bootstrap capacitor",
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

export function App() {
  const [feature] = useState("bootstrap");
  const [locale, setLocale] = useState<Locale>("zh");
  const [method, setMethod] = useState<MethodId>("ti");
  const [values, setValues] = useState<Record<MethodId, NumericState>>(defaults);
  const [units, setUnits] = useState<Record<MethodId, UnitState>>(defaultUnits);
  const [analysis, setAnalysis] = useState<CalculationResult | null>(null);
  const [analysisDirty, setAnalysisDirty] = useState(false);
  const activeValues = values[method];
  const activeUnits = units[method];
  const t = translations[locale];

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

  function resetMethod() {
    setValues((current) => ({ ...current, [method]: defaults[method] }));
    setUnits((current) => ({ ...current, [method]: defaultUnits[method] }));
    setAnalysis(null);
    setAnalysisDirty(false);
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

  return (
    <div className="app-frame">
      <aside className="feature-nav" aria-label="EE Tool features">
        <div className="brand-block">
          <span>EE</span>
          <strong>Tool</strong>
        </div>
        <nav>
          <button className={feature === "bootstrap" ? "active" : ""} type="button">
            {t.features.bootstrap}
          </button>
          <button type="button" disabled>
            {t.features.gate}
          </button>
          <button type="button" disabled>
            {t.features.rc}
          </button>
          <button type="button" disabled>
            {t.features.loss}
          </button>
        </nav>
      </aside>

      <main className="app-shell">
        <section className="tool-header">
          <div>
            <p className="eyebrow">{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <p className="subtitle">{t.subtitle}</p>
          </div>
          <label className="language-switch">
            <span>{t.language}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              <option value="zh">Traditional Chinese</option>
              <option value="en">English</option>
            </select>
          </label>
        </section>

        <section className="method-tabs" aria-label="Calculation method">
          {(Object.keys(methodLabels) as MethodId[]).map((id) => (
            <button
              key={id}
              className={id === method ? "active" : ""}
              type="button"
              onClick={() => switchMethod(id)}
            >
              {methodLabels[id]}
            </button>
          ))}
        </section>

        <section className="workspace">
          <form className="input-panel">
            <div className="panel-heading">
              <h2>{methodLabels[method]}</h2>
              <button type="button" onClick={resetMethod}>
                {t.reset}
              </button>
            </div>
            {method === "ti" && (
              <TiFields
                locale={locale}
                values={activeValues}
                units={activeUnits}
                onChange={updateValue}
                onUnitChange={updateUnit}
              />
            )}
            {method === "onsemi" && (
              <OnsemiFields
                locale={locale}
                values={activeValues}
                units={activeUnits}
                onChange={updateValue}
                onUnitChange={updateUnit}
              />
            )}
            {method === "infineon" && (
              <InfineonFields
                locale={locale}
                values={activeValues}
                units={activeUnits}
                onChange={updateValue}
                onUnitChange={updateUnit}
              />
            )}
            <div className="analysis-actions">
              <button className="run-analysis" type="button" onClick={runAnalysis}>
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
      </main>
    </div>
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
      <span>{label}</span>
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

function MRow({ children }: { children: ReactNode }) {
  return createElement("mrow", null, children);
}

function Mo({ children }: { children: ReactNode }) {
  return createElement("mo", null, children);
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
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
