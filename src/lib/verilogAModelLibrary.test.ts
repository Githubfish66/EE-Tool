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

  it("ships the externally-windowed MOSFET loss monitor source", () => {
    const model = getVerilogAModel("mosfet-loss-monitor");

    expect(model.fileName).toBe("mosfet_loss_monitor.va");
    expect(model.source).toContain("module mosfet_loss_monitor");
    expect(model.source).toContain("branch (id_sense_p, id_sense_n) drain_sensor;");
    expect(model.source).toContain("branch (drv_sense_p, drv_sense_n) driver_sensor;");
    expect(model.source).toContain("V(p_turn_on) <+ ((V(win_on) > VWIN) ? p_drain_loss : 0.0);");
    expect(model.source).toContain("V(p_body_diode) <+ ((V(win_body) > VWIN) ? p_drain_loss : 0.0);");
    expect(model.source).toContain("V(p_gate_drive) <+ p_driver_loss;");
    expect(model.behavior.join(" ")).toContain("mutually exclusive windows");
  });

  it("formats MOSFET loss monitor SIMetrix parameters", () => {
    const model = getVerilogAModel("mosfet-loss-monitor");

    expect(formatVerilogAParameterAssignments(model)).toBe(
      ["VWIN=0.5", "ID_SIGN=1.0", "IDRV_SIGN=1.0", "CLAMP_NEGATIVE=1"].join("\n"),
    );
  });
});
