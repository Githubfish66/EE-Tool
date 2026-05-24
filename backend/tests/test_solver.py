import sympy as sp

from rlc_symbolic_solver import CurrentRequest, VoltageRequest, parse_netlist, solve_output


def test_solve_example_i1_expression_and_numeric_value() -> None:
    parsed = parse_netlist(
        """
        V$IPROBE8 4 0 0.0
        .PRINT I(V$IPROBE8)
        .GRAPH IPROBE8#P curveLabel="I1"
        V$IPROBE9 5 0 0.0
        R3 2 3 5
        R4 2 4 2
        R5 2 5 8
        V2 3 0 5
        """
    )

    result = solve_output(parsed.components, parsed.outputs[0])

    R3, R4, R5, V2 = sp.symbols("R3 R4 R5 V2")
    expected = R5 * V2 / (R3 * R4 + R3 * R5 + R4 * R5)
    assert sp.simplify(result.expression - expected) == 0
    assert result.numeric_value == sp.Float(20 / 33)


def test_solve_voltage_output() -> None:
    parsed = parse_netlist(
        """
        .PRINT V(2)
        R1 2 1 10
        R2 2 0 10
        V1 1 0 5
        """
    )

    result = solve_output(parsed.components, parsed.outputs[0])

    R1, R2, V1 = sp.symbols("R1 R2 V1")
    expected = R2 * V1 / (R1 + R2)
    assert sp.simplify(result.expression - expected) == 0
    assert result.numeric_value == sp.Float(2.5)
    assert result.time_domain is not None
    t = sp.Symbol("t", real=True, nonnegative=True)
    assert sp.simplify(result.time_domain.numeric_time.subs(sp.Heaviside(t), 1) - sp.Float(2.5)) == 0


def test_supports_voltage_request_between_two_nodes() -> None:
    parsed = parse_netlist(
        """
        R1 2 1 10
        R2 2 0 10
        V1 1 0 5
        """
    )
    output = VoltageRequest(expression="V(1,2)", label=None, positive_node="1", negative_node="2")

    result = solve_output(parsed.components, output)

    assert result.numeric_value == sp.Float(2.5)


def test_solve_rl_step_time_domain() -> None:
    parsed = parse_netlist(
        """
        .tran 10u 0
        V$IPROBE1 2 0 0
        .PRINT I(V$IPROBE1)
        L1 1 2 1u
        R1 1 0 5
        V1 1 0 5
        """
    )

    result = solve_output(parsed.components, parsed.outputs[0], parsed.transient_stop_seconds)

    assert result.time_domain is not None
    assert result.time_domain.waveform
