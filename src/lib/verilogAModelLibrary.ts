export type VerilogAModelId = "deadtime-generator" | "mosfet-loss-monitor";

export type VerilogAModelParameter = {
  name: string;
  defaultValue: string;
  description: string;
};

export type VerilogAModelPort = {
  name: string;
  direction: "input" | "output";
  description: string;
};

export type VerilogAModel = {
  id: VerilogAModelId;
  title: string;
  category: string;
  fileName: string;
  moduleName: string;
  summary: string;
  behavior: string[];
  ports: VerilogAModelPort[];
  parameters: VerilogAModelParameter[];
  useSteps: string[];
  source: string;
};

const deadtimeGeneratorSource = `\`include "disciplines.vams"

module deadtime_gen(in, out_h, out_l);

    input in;
    output out_h, out_l;

    electrical in;
    electrical out_h, out_l;

    parameter real VHIGH = 5.0;
    parameter real VLOW  = 0.0;
    parameter real VTH   = 2.5;

    parameter real TD_H = 20n;
    parameter real TD_L = 20n;

    parameter real TR = 1n;
    parameter real TF = 1n;

    integer in_state;
    integer h_cmd;
    integer l_cmd;
    integer h_pending;
    integer l_pending;

    real t_h_on;
    real t_l_on;

    analog begin

        @(initial_step) begin
            in_state = (V(in) > VTH);

            h_pending = 0;
            l_pending = 0;
            t_h_on = 0;
            t_l_on = 0;

            if (in_state) begin
                h_cmd = 1;
                l_cmd = 0;
            end
            else begin
                h_cmd = 0;
                l_cmd = 1;
            end
        end

        @(cross(V(in) - VTH, +1)) begin
            in_state = 1;

            h_cmd = 0;
            l_cmd = 0;

            t_h_on = $abstime + TD_H;
            h_pending = 1;
            l_pending = 0;
        end

        @(cross(V(in) - VTH, -1)) begin
            in_state = 0;

            h_cmd = 0;
            l_cmd = 0;

            t_l_on = $abstime + TD_L;
            l_pending = 1;
            h_pending = 0;
        end

        @(timer(t_h_on, 0, 0, h_pending)) begin
            if (in_state)
                h_cmd = 1;

            h_pending = 0;
        end

        @(timer(t_l_on, 0, 0, l_pending)) begin
            if (!in_state)
                l_cmd = 1;

            l_pending = 0;
        end

        V(out_h) <+ transition(h_cmd ? VHIGH : VLOW, 0, TR, TF);
        V(out_l) <+ transition(l_cmd ? VHIGH : VLOW, 0, TR, TF);

    end

endmodule
`;

const mosfetLossMonitorSource = `\`include "disciplines.vams"

module mosfet_loss_monitor(
    d, g, s,
    id_sense_p, id_sense_n,
    vdrv_p, vdrv_n, drv_sense_p, drv_sense_n,
    win_cond, win_on, win_off, win_dead, win_body,
    p_total, p_conduction, p_turn_on, p_turn_off,
    p_gate_drive, p_dead_time, p_body_diode
);

    input d, g, s;
    inout id_sense_p, id_sense_n;
    input vdrv_p, vdrv_n;
    inout drv_sense_p, drv_sense_n;
    input win_cond, win_on, win_off, win_dead, win_body;
    output p_total, p_conduction, p_turn_on, p_turn_off;
    output p_gate_drive, p_dead_time, p_body_diode;

    electrical d, g, s;
    electrical id_sense_p, id_sense_n;
    electrical vdrv_p, vdrv_n, drv_sense_p, drv_sense_n;
    electrical win_cond, win_on, win_off, win_dead, win_body;
    electrical p_total, p_conduction, p_turn_on, p_turn_off;
    electrical p_gate_drive, p_dead_time, p_body_diode;

    branch (id_sense_p, id_sense_n) drain_sensor;
    branch (drv_sense_p, drv_sense_n) driver_sensor;

    parameter real VWIN = 0.5;
    parameter real ID_SIGN = 1.0;
    parameter real IDRV_SIGN = 1.0;
    parameter integer CLAMP_NEGATIVE = 1;

    real idrain;
    real idrv;
    real p_drain_raw;
    real p_drain_loss;
    real p_driver_raw;
    real p_driver_loss;
    analog begin
        // Insert each zero-volt sensor branch in series with the path being measured.
        V(drain_sensor) <+ 0.0;
        V(driver_sensor) <+ 0.0;

        idrain = ID_SIGN * I(drain_sensor);
        idrv = IDRV_SIGN * I(driver_sensor);

        p_drain_raw = V(d, s) * idrain;
        p_driver_raw = V(vdrv_p, vdrv_n) * idrv;

        if ((CLAMP_NEGATIVE != 0) && (p_drain_raw < 0.0))
            p_drain_loss = 0.0;
        else
            p_drain_loss = p_drain_raw;

        if ((CLAMP_NEGATIVE != 0) && (p_driver_raw < 0.0))
            p_driver_loss = 0.0;
        else
            p_driver_loss = p_driver_raw;

        V(p_total) <+ p_drain_loss;
        V(p_conduction) <+ ((V(win_cond) > VWIN) ? p_drain_loss : 0.0);
        V(p_turn_on) <+ ((V(win_on) > VWIN) ? p_drain_loss : 0.0);
        V(p_turn_off) <+ ((V(win_off) > VWIN) ? p_drain_loss : 0.0);
        V(p_dead_time) <+ ((V(win_dead) > VWIN) ? p_drain_loss : 0.0);
        V(p_body_diode) <+ ((V(win_body) > VWIN) ? p_drain_loss : 0.0);
        V(p_gate_drive) <+ p_driver_loss;
    end

endmodule
`;

export const verilogAModels: VerilogAModel[] = [
  {
    id: "deadtime-generator",
    title: "Dead-Time Generator",
    category: "PWM logic",
    fileName: "deadtime_gen.va",
    moduleName: "deadtime_gen",
    summary:
      "Turn one PWM input into non-overlap high-side and low-side logic outputs with independent turn-on dead time.",
    behavior: [
      "Input rising edge turns out_l off immediately and turns out_h on after TD_H.",
      "Input falling edge turns out_h off immediately and turns out_l on after TD_L.",
      "The model uses timer events for delayed turn-on instead of delayed waveform history.",
    ],
    ports: [
      { name: "in", direction: "input", description: "PWM command input." },
      { name: "out_h", direction: "output", description: "High-side non-overlap output." },
      { name: "out_l", direction: "output", description: "Low-side non-overlap output." },
    ],
    parameters: [
      { name: "VHIGH", defaultValue: "5.0", description: "High output voltage." },
      { name: "VLOW", defaultValue: "0.0", description: "Low output voltage." },
      { name: "VTH", defaultValue: "2.5", description: "Input logic threshold." },
      { name: "TD_H", defaultValue: "20n", description: "High-side turn-on dead time." },
      { name: "TD_L", defaultValue: "20n", description: "Low-side turn-on dead time." },
      { name: "TR", defaultValue: "1n", description: "Output rise time." },
      { name: "TF", defaultValue: "1n", description: "Output fall time." },
    ],
    useSteps: [
      "Download the .va file and create a Verilog-A symbol from it in SIMetrix.",
      "Connect the PWM input to in and connect out_h/out_l to the following logic or driver model.",
      "Override instance parameters such as TD_H=50n TD_L=50n from the symbol model parameters.",
      "Verify non-overlap and short-pulse behavior with the target PWM waveform before replacing the original schematic logic.",
    ],
    source: deadtimeGeneratorSource,
  },
  {
    id: "mosfet-loss-monitor",
    title: "MOSFET Loss Monitor",
    category: "Power analysis",
    fileName: "mosfet_loss_monitor.va",
    moduleName: "mosfet_loss_monitor",
    summary:
      "Measure MOSFET drain-path loss and gate-driver supply loss, then split drain loss with external SIMetrix window signals.",
    behavior: [
      "p_total reports clamped VDS x ID drain-path loss from the inline drain current sensor.",
      "p_conduction, p_turn_on, p_turn_off, p_dead_time, and p_body_diode reuse p_total only while their external window input is high.",
      "p_gate_drive reports the separate gate-driver supply loss from the driver supply voltage and inline supply current sensor.",
      "Use mutually exclusive windows before summing categories; body-diode and dead-time windows may intentionally observe the same interval.",
    ],
    ports: [
      { name: "d / g / s", direction: "input", description: "MOSFET drain, gate, and source nodes." },
      {
        name: "id_sense_p / id_sense_n",
        direction: "input",
        description: "Zero-volt inline drain-current sensor branch; p to n orientation sets positive ID.",
      },
      {
        name: "vdrv_p / vdrv_n",
        direction: "input",
        description: "Gate-driver supply voltage nodes used for VDRV.",
      },
      {
        name: "drv_sense_p / drv_sense_n",
        direction: "input",
        description: "Zero-volt inline gate-driver supply current sensor branch.",
      },
      {
        name: "win_cond / win_on / win_off",
        direction: "input",
        description: "External conduction, turn-on, and turn-off classification windows.",
      },
      {
        name: "win_dead / win_body",
        direction: "input",
        description: "External dead-time and body-diode classification windows.",
      },
      {
        name: "p_total / p_conduction",
        direction: "output",
        description: "Power waveform outputs where 1 V represents 1 W.",
      },
      {
        name: "p_turn_on / p_turn_off",
        direction: "output",
        description: "Turn-on and turn-off drain-path power slices.",
      },
      {
        name: "p_gate_drive",
        direction: "output",
        description: "Gate-driver supply power waveform.",
      },
      {
        name: "p_dead_time / p_body_diode",
        direction: "output",
        description: "Dead-time and body-diode drain-path power slices.",
      },
    ],
    parameters: [
      { name: "VWIN", defaultValue: "0.5", description: "Window-input high threshold." },
      {
        name: "ID_SIGN",
        defaultValue: "1.0",
        description: "Flip to -1.0 if the drain sensor current orientation is reversed.",
      },
      {
        name: "IDRV_SIGN",
        defaultValue: "1.0",
        description: "Flip to -1.0 if the driver supply sensor orientation is reversed.",
      },
      {
        name: "CLAMP_NEGATIVE",
        defaultValue: "1",
        description: "Clamp negative instantaneous power to zero when set to 1.",
      },
    ],
    useSteps: [
      "Download the .va file, create a SIMetrix Verilog-A symbol, and connect d/g/s to the MOSFET nodes.",
      "Place id_sense_p/id_sense_n in series with the measured drain path and drv_sense_p/drv_sense_n in series with the gate-driver supply path.",
      "Connect vdrv_p/vdrv_n across the gate-driver supply; this makes p_gate_drive represent supply-side driver loss instead of VGS x IG gate energy.",
      "Drive win_cond, win_on, win_off, win_dead, and win_body with external voltage windows above VWIN for the intervals you want classified.",
      "Probe the p_* outputs as power waveforms where 1 V equals 1 W; average them for power or integrate a switching window for energy.",
      "Keep category windows mutually exclusive when building a loss sum. If win_dead and win_body overlap, those outputs are two views of the same drain-path energy.",
    ],
    source: mosfetLossMonitorSource,
  },
];

export function getVerilogAModel(modelId: VerilogAModelId): VerilogAModel {
  const model = verilogAModels.find((item) => item.id === modelId);
  if (!model) {
    throw new Error(`Unknown Verilog-A model: ${modelId}`);
  }
  return model;
}

export function formatVerilogAParameterAssignments(model: VerilogAModel): string {
  return model.parameters
    .map((parameter) => `${parameter.name}=${parameter.defaultValue}`)
    .join("\n");
}
