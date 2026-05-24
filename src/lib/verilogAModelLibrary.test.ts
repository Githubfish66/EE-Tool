import { describe, expect, it } from "vitest";
import {
  formatVerilogAParameterAssignments,
  getVerilogAModel,
  verilogAModels,
} from "./verilogAModelLibrary";

describe("verilogAModelLibrary", () => {
  it("keeps model ids unique", () => {
    const ids = verilogAModels.map((model) => model.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ships the timer-based dead-time generator source", () => {
    const model = getVerilogAModel("deadtime-generator");

    expect(model.fileName).toBe("deadtime_gen.va");
    expect(model.source).toContain("module deadtime_gen");
    expect(model.source).toContain("@(timer(t_h_on");
    expect(model.source).not.toContain("absdelay");
    expect(model.parameters.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining(["TD_H", "TD_L", "VTH"]),
    );
  });

  it("formats SIMetrix model parameter assignments for copy and paste", () => {
    const model = getVerilogAModel("deadtime-generator");

    expect(formatVerilogAParameterAssignments(model)).toBe(
      ["VHIGH=5.0", "VLOW=0.0", "VTH=2.5", "TD_H=20n", "TD_L=20n", "TR=1n", "TF=1n"].join(
        "\n",
      ),
    );
  });

  it("ships the VDS edge timing marker source", () => {
    const model = getVerilogAModel("vds-edge-marker");

    expect(model.fileName).toBe("vds_edge_marker.va");
    expect(model.source).toContain("mark_turn_on_end, mark_turn_off_end");
    expect(model.source).toContain("win_turn_on, win_turn_off");
    expect(model.source).toContain("t_turn_on, t_turn_off");
    expect(model.source).toContain("@(cross(V(g, s) - VGS_ON_ARM, +1))");
    expect(model.source).toContain("@(cross(V(g, s) - VGS_OFF_ARM, -1))");
    expect(model.source).toContain("turn_on_arm_until = $abstime + ARM_TIMEOUT;");
    expect(model.source).toContain("turn_off_arm_until = $abstime + ARM_TIMEOUT;");
    expect(model.source).toContain("@(timer(turn_on_arm_until, 0, 0, turn_on_armed))");
    expect(model.source).toContain("@(timer(turn_off_arm_until, 0, 0, turn_off_armed))");
    expect(model.source).toContain("@(cross(V(d, s) - (VDS_HIGH_STABLE - VDS_DEPART_DELTA), -1))");
    expect(model.source).toContain("@(cross(V(d, s) - (VDS_LOW_STABLE + VDS_DEPART_DELTA), +1))");
    expect(model.source).toContain("@(cross(V(d, s) - (VDS_LOW_STABLE + VDS_END_DELTA), -1))");
    expect(model.source).toContain("@(cross(V(d, s) - (VDS_HIGH_STABLE - VDS_END_DELTA), +1))");
    expect(model.source).toContain("if (turn_on_armed && (V(g, s) > VGS_ON_ARM))");
    expect(model.source).toContain("if (turn_off_armed && (V(g, s) < VGS_OFF_ARM))");
    expect(model.source).toContain("turn_on_until = $abstime + MARK_WIDTH;");
    expect(model.source).toContain("measured_turn_off_time = ($abstime - turn_off_start_time) / TIME_SCALE;");
    expect(model.source).toContain("V(mark_turn_on) <+ transition");
    expect(model.source).toContain("V(win_turn_off) <+ transition");
    expect(model.source).toContain("V(t_turn_off) <+ measured_turn_off_time;");
    expect(model.parameters.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining([
        "VDS_HIGH_STABLE",
        "VDS_LOW_STABLE",
        "VDS_DEPART_DELTA",
        "VDS_END_DELTA",
        "VGS_ON_ARM",
        "VGS_OFF_ARM",
        "ARM_TIMEOUT",
        "MARK_WIDTH",
        "TIME_SCALE",
      ]),
    );
  });

  it("formats VDS edge marker threshold assignments", () => {
    const model = getVerilogAModel("vds-edge-marker");

    expect(formatVerilogAParameterAssignments(model)).toBe(
      [
        "VDS_HIGH_STABLE=50.0",
        "VDS_LOW_STABLE=0.0",
        "VDS_DEPART_DELTA=2.0",
        "VDS_END_DELTA=2.0",
        "VGS_ON_ARM=4.0",
        "VGS_OFF_ARM=1.0",
        "ARM_TIMEOUT=200n",
        "MARK_WIDTH=20n",
        "TIME_SCALE=1n",
        "VHIGH=1.0",
        "VLOW=0.0",
        "TR=100p",
        "TF=100p",
      ].join("\n"),
    );
  });
});
