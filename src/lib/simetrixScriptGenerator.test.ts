import { describe, expect, it } from "vitest";
import {
  countSimetrixRuns,
  generateSimetrixSweepScript,
  normalizeModelList,
  parseSimetrixNetlist,
} from "./simetrixScriptGenerator";

describe("parseSimetrixNetlist", () => {
  it("detects likely switching components and extracts model tokens", () => {
    const netlist = `
* SIMetrix generated netlist
Q1 n1 n2 n3 IGC033S101_L1
M2 d g s b MOS_A
S3 out in ctrlp ctrln SW_MODEL
XU4 d g s VendorMosfetModel PARAMS: Rg=2
R1 n1 n2 10
.tran 0 1m
`;

    const result = parseSimetrixNetlist(netlist);

    expect(result.components).toEqual([
      {
        reference: "M2",
        kind: "mosfet",
        model: "MOS_A",
        lineNumber: 4,
        sourceLine: "M2 d g s b MOS_A",
      },
      {
        reference: "Q1",
        kind: "bjt_igbt",
        model: "IGC033S101_L1",
        lineNumber: 3,
        sourceLine: "Q1 n1 n2 n3 IGC033S101_L1",
      },
      {
        reference: "S3",
        kind: "switch",
        model: "SW_MODEL",
        lineNumber: 5,
        sourceLine: "S3 out in ctrlp ctrln SW_MODEL",
      },
      {
        reference: "XU4",
        kind: "subcircuit",
        model: "VendorMosfetModel",
        lineNumber: 6,
        sourceLine: "XU4 d g s VendorMosfetModel PARAMS: Rg=2",
      },
    ]);
  });

  it("ignores comments, control lines, continuations, and duplicate references", () => {
    const result = parseSimetrixNetlist(`
* comment
.model TEST
+ continued
Q1 a b c MODEL_A
Q1 a b c MODEL_B
C1 a b 1n
`);

    expect(result.components).toHaveLength(1);
    expect(result.components[0].model).toBe("MODEL_A");
    expect(result.ignoredLineCount).toBeGreaterThanOrEqual(4);
  });
});

describe("normalizeModelList", () => {
  it("normalizes whitespace, commas, semicolons, quotes, and duplicates", () => {
    expect(normalizeModelList("IGC033S101_L1, 'IGC025S08S1_L1'; IGC033S101_L1")).toEqual([
      "IGC033S101_L1",
      "IGC025S08S1_L1",
    ]);
  });
});

describe("generateSimetrixSweepScript", () => {
  it("generates a same-model foreach sweep", () => {
    const script = generateSimetrixSweepScript({
      references: ["Q1", "Q5"],
      models: ["IGC033S101_L1", "IGC025S08S1_L1"],
      mode: "same-model",
      netlistFileName: "design.net",
      createNetlistBeforeRun: true,
    });

    expect(script).toContain("Let models = ['IGC033S101_L1', 'IGC025S08S1_L1']");
    expect(script).toContain("Let refs = ['Q1', 'Q5']");
    expect(script).toContain("Let SetComponentValue(ref & '.value', model)");
    expect(script).toContain("Netlist design.net");
    expect(script).toContain("run design.net");
  });

  it("generates all model combinations for selected references", () => {
    const script = generateSimetrixSweepScript({
      references: ["Q1", "Q5"],
      models: ["A", "B"],
      mode: "all-combinations",
      netlistFileName: "loss.net",
      createNetlistBeforeRun: false,
    });

    expect(script.match(/\* Case/g)).toHaveLength(4);
    expect(script).toContain("* Case 2: Q1=A, Q5=B");
    expect(script).toContain("Let SetComponentValue('Q5.value', 'B')");
    expect(script).not.toContain("Netlist loss.net");
    expect(script).toContain("run loss.net");
  });

  it("throws when required inputs are missing", () => {
    expect(() =>
      generateSimetrixSweepScript({
        references: [],
        models: ["A"],
        mode: "same-model",
        netlistFileName: "design.net",
        createNetlistBeforeRun: true,
      }),
    ).toThrow("At least one component reference is required.");
  });
});

describe("countSimetrixRuns", () => {
  it("counts same-model and all-combination runs", () => {
    expect(countSimetrixRuns(2, 3, "same-model")).toBe(3);
    expect(countSimetrixRuns(2, 3, "all-combinations")).toBe(9);
  });
});
