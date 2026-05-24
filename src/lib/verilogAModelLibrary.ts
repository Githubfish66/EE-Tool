export type VerilogAModelId =
  | "deadtime-generator"
  | "vds-edge-marker";

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

const vdsEdgeMarkerSource = `\`include "disciplines.vams"

module vds_edge_marker(
    d, g, s,
    mark_turn_on, mark_turn_off,
    mark_turn_on_end, mark_turn_off_end,
    win_turn_on, win_turn_off,
    t_turn_on, t_turn_off
);

    input d, g, s;
    output mark_turn_on, mark_turn_off;
    output mark_turn_on_end, mark_turn_off_end;
    output win_turn_on, win_turn_off;
    output t_turn_on, t_turn_off;

    electrical d, g, s;
    electrical mark_turn_on, mark_turn_off;
    electrical mark_turn_on_end, mark_turn_off_end;
    electrical win_turn_on, win_turn_off;
    electrical t_turn_on, t_turn_off;

    parameter real VDS_HIGH_STABLE = 50.0;
    parameter real VDS_LOW_STABLE = 0.0;
    parameter real VDS_DEPART_DELTA = 2.0;
    parameter real VDS_END_DELTA = 2.0;
    parameter real VGS_ON_ARM = 4.0;
    parameter real VGS_OFF_ARM = 1.0;
    parameter real ARM_TIMEOUT = 200n;
    parameter real MARK_WIDTH = 20n;
    parameter real TIME_SCALE = 1n;
    parameter real VHIGH = 1.0;
    parameter real VLOW = 0.0;
    parameter real TR = 100p;
    parameter real TF = 100p;

    real turn_on_until;
    real turn_off_until;
    real turn_on_end_until;
    real turn_off_end_until;
    real turn_on_arm_until;
    real turn_off_arm_until;
    real turn_on_start_time;
    real turn_off_start_time;
    real measured_turn_on_time;
    real measured_turn_off_time;
    integer turn_on_armed;
    integer turn_off_armed;
    integer turn_on_active;
    integer turn_off_active;
    integer turn_on_mark;
    integer turn_off_mark;
    integer turn_on_end_mark;
    integer turn_off_end_mark;

    analog begin
        @(initial_step) begin
            turn_on_until = -1.0;
            turn_off_until = -1.0;
            turn_on_end_until = -1.0;
            turn_off_end_until = -1.0;
            turn_on_arm_until = -1.0;
            turn_off_arm_until = -1.0;
            turn_on_start_time = 0.0;
            turn_off_start_time = 0.0;
            measured_turn_on_time = 0.0;
            measured_turn_off_time = 0.0;
            turn_on_armed = 0;
            turn_off_armed = 0;
            turn_on_active = 0;
            turn_off_active = 0;
            turn_on_mark = 0;
            turn_off_mark = 0;
            turn_on_end_mark = 0;
            turn_off_end_mark = 0;
        end

        @(cross(V(g, s) - VGS_ON_ARM, +1)) begin
            turn_on_armed = 1;
            turn_off_armed = 0;
            turn_on_arm_until = $abstime + ARM_TIMEOUT;
        end

        @(cross(V(g, s) - VGS_OFF_ARM, -1)) begin
            turn_off_armed = 1;
            turn_on_armed = 0;
            turn_off_arm_until = $abstime + ARM_TIMEOUT;
        end

        @(timer(turn_on_arm_until, 0, 0, turn_on_armed)) begin
            turn_on_armed = 0;
        end

        @(timer(turn_off_arm_until, 0, 0, turn_off_armed)) begin
            turn_off_armed = 0;
        end

        @(cross(V(d, s) - (VDS_HIGH_STABLE - VDS_DEPART_DELTA), -1)) begin
            if (turn_on_armed && (V(g, s) > VGS_ON_ARM)) begin
                turn_on_until = $abstime + MARK_WIDTH;
                turn_on_start_time = $abstime;
                turn_on_mark = 1;
                turn_off_mark = 0;
                turn_on_active = 1;
                turn_off_active = 0;
                turn_on_armed = 0;
            end
        end

        @(cross(V(d, s) - (VDS_LOW_STABLE + VDS_DEPART_DELTA), +1)) begin
            if (turn_off_armed && (V(g, s) < VGS_OFF_ARM)) begin
                turn_off_until = $abstime + MARK_WIDTH;
                turn_off_start_time = $abstime;
                turn_off_mark = 1;
                turn_on_mark = 0;
                turn_off_active = 1;
                turn_on_active = 0;
                turn_off_armed = 0;
            end
        end

        @(cross(V(d, s) - (VDS_LOW_STABLE + VDS_END_DELTA), -1)) begin
            if (turn_on_active) begin
                turn_on_end_until = $abstime + MARK_WIDTH;
                turn_on_end_mark = 1;
                turn_on_active = 0;
                measured_turn_on_time = ($abstime - turn_on_start_time) / TIME_SCALE;
            end
        end

        @(cross(V(d, s) - (VDS_HIGH_STABLE - VDS_END_DELTA), +1)) begin
            if (turn_off_active) begin
                turn_off_end_until = $abstime + MARK_WIDTH;
                turn_off_end_mark = 1;
                turn_off_active = 0;
                measured_turn_off_time = ($abstime - turn_off_start_time) / TIME_SCALE;
            end
        end

        @(timer(turn_on_until, 0, 0, turn_on_mark)) begin
            turn_on_mark = 0;
        end

        @(timer(turn_off_until, 0, 0, turn_off_mark)) begin
            turn_off_mark = 0;
        end

        @(timer(turn_on_end_until, 0, 0, turn_on_end_mark)) begin
            turn_on_end_mark = 0;
        end

        @(timer(turn_off_end_until, 0, 0, turn_off_end_mark)) begin
            turn_off_end_mark = 0;
        end

        V(mark_turn_on) <+ transition(turn_on_mark ? VHIGH : VLOW, 0, TR, TF);
        V(mark_turn_off) <+ transition(turn_off_mark ? VHIGH : VLOW, 0, TR, TF);
        V(mark_turn_on_end) <+ transition(turn_on_end_mark ? VHIGH : VLOW, 0, TR, TF);
        V(mark_turn_off_end) <+ transition(turn_off_end_mark ? VHIGH : VLOW, 0, TR, TF);
        V(win_turn_on) <+ transition(turn_on_active ? VHIGH : VLOW, 0, TR, TF);
        V(win_turn_off) <+ transition(turn_off_active ? VHIGH : VLOW, 0, TR, TF);
        V(t_turn_on) <+ measured_turn_on_time;
        V(t_turn_off) <+ measured_turn_off_time;
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
    id: "vds-edge-marker",
    title: "VDS Edge Timing Marker",
    category: "Timing analysis",
    fileName: "vds_edge_marker.va",
    moduleName: "vds_edge_marker",
    summary:
      "Mark gate-qualified switching start/end points and output measured VDS transition windows.",
    behavior: [
      "A VGS rising crossing arms the next turn-on marker; VDS must then fall below VDS_HIGH_STABLE - VDS_DEPART_DELTA.",
      "A VGS falling crossing arms the next turn-off marker; VDS must then rise above VDS_LOW_STABLE + VDS_DEPART_DELTA.",
      "End markers fire when VDS reaches the opposite plateau boundary set by VDS_END_DELTA.",
      "win_turn_on and win_turn_off stay high between the detected start and end points.",
      "t_turn_on and t_turn_off report the last measured transition time divided by TIME_SCALE.",
      "ARM_TIMEOUT clears a stale gate arm if the matching VDS departure does not happen soon enough.",
      "MARK_WIDTH controls only the visible start/end marker pulse width; it does not affect the measured transition time.",
    ],
    ports: [
      { name: "d / g / s", direction: "input", description: "Drain, gate, and source nodes used to observe VDS and VGS." },
      {
        name: "mark_turn_on",
        direction: "output",
        description: "Marker pulse for the VDS falling-edge turn-on timing point.",
      },
      {
        name: "mark_turn_off",
        direction: "output",
        description: "Start marker pulse for the VDS rising-edge turn-off timing point.",
      },
      {
        name: "mark_turn_on_end / mark_turn_off_end",
        direction: "output",
        description: "End marker pulses when VDS reaches the opposite plateau boundary.",
      },
      {
        name: "win_turn_on / win_turn_off",
        direction: "output",
        description: "Active switching windows from detected start to detected end.",
      },
      {
        name: "t_turn_on / t_turn_off",
        direction: "output",
        description: "Last measured switching time divided by TIME_SCALE.",
      },
    ],
    parameters: [
      {
        name: "VDS_HIGH_STABLE",
        defaultValue: "50.0",
        description: "Stable high VDS level before turn-on.",
      },
      {
        name: "VDS_LOW_STABLE",
        defaultValue: "0.0",
        description: "Stable low VDS level before turn-off.",
      },
      {
        name: "VDS_DEPART_DELTA",
        defaultValue: "2.0",
        description: "Voltage departure from the stable VDS level that marks transition start.",
      },
      {
        name: "VDS_END_DELTA",
        defaultValue: "2.0",
        description: "Voltage distance from the opposite stable VDS level that marks transition end.",
      },
      {
        name: "VGS_ON_ARM",
        defaultValue: "4.0",
        description: "Rising VGS threshold that arms the next turn-on VDS departure marker.",
      },
      {
        name: "VGS_OFF_ARM",
        defaultValue: "1.0",
        description: "Falling VGS threshold that arms the next turn-off VDS departure marker.",
      },
      {
        name: "ARM_TIMEOUT",
        defaultValue: "200n",
        description: "Maximum time a gate crossing can wait for the matching VDS departure.",
      },
      { name: "MARK_WIDTH", defaultValue: "20n", description: "Visible marker pulse width." },
      {
        name: "TIME_SCALE",
        defaultValue: "1n",
        description: "Time scaling for t_turn_on and t_turn_off outputs; 1n makes volts read as ns.",
      },
      { name: "VHIGH", defaultValue: "1.0", description: "Marker high output level." },
      { name: "VLOW", defaultValue: "0.0", description: "Marker low output level." },
      { name: "TR", defaultValue: "100p", description: "Marker output rise time." },
      { name: "TF", defaultValue: "100p", description: "Marker output fall time." },
    ],
    useSteps: [
      "Download the .va file and create a SIMetrix Verilog-A symbol.",
      "Connect d, g, and s to the MOSFET drain, gate, and source nodes, then label the outputs such as MARK_Q1_ON and MARK_Q1_OFF.",
      "Set VGS_ON_ARM and VGS_OFF_ARM from the actual gate waveform so the marker only responds after the correct gate-command direction.",
      "Set ARM_TIMEOUT just longer than the expected gate-to-VDS delay so an old gate edge cannot trigger a later unrelated VDS crossing.",
      "Set VDS_HIGH_STABLE to the off-state VDS plateau and VDS_LOW_STABLE to the on-state VDS plateau.",
      "Set VDS_DEPART_DELTA just above normal ripple/noise for the start point, and set VDS_END_DELTA near the opposite plateau boundary for the end point.",
      "Plot VGS, VDS, Power(Q1), start/end markers, and win_turn_off or win_turn_on together to confirm the full switching window.",
      "Use t_turn_on and t_turn_off as scaled timing readouts; with TIME_SCALE=1n, an output of 7.5 means 7.5 ns.",
    ],
    source: vdsEdgeMarkerSource,
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
