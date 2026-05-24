from pathlib import Path

import pytest

from rlc_symbolic_solver import (
    CurrentRequest,
    NetlistParseError,
    Resistor,
    VoltageRequest,
    VoltageSource,
    parse_netlist,
    parse_netlist_file,
)


def test_parse_components_and_labeled_outputs() -> None:
    parsed = parse_netlist(
        """
        V$IPROBE8 4 0 0.0
        .PRINT I(V$IPROBE8)
        .GRAPH IPROBE8#P curveLabel="I1"
        R3 2 3 5
        .PRINT V(2)
        .GRAPH V2#P curveLabel="Vnode2"
        V2 3 0 5
        """
    )

    assert parsed.components == [
        VoltageSource(name="V$IPROBE8", positive_node="4", negative_node="0", value=0.0),
        Resistor(name="R3", positive_node="2", negative_node="3", value=5.0),
        VoltageSource(name="V2", positive_node="3", negative_node="0", value=5.0),
    ]
    assert parsed.outputs == [
        CurrentRequest(expression="I(V$IPROBE8)", label="I1", component_name="V$IPROBE8"),
        VoltageRequest(expression="V(2)", label="Vnode2", positive_node="2"),
    ]


def test_parse_example_txt_outputs() -> None:
    parsed = parse_netlist_file(Path("example.txt"))

    assert parsed.outputs == [
        CurrentRequest(expression="I(V$IPROBE1)", label="I3", component_name="V$IPROBE1"),
        CurrentRequest(expression="I(V$IPROBE8)", label="I1", component_name="V$IPROBE8"),
        CurrentRequest(expression="I(V$IPROBE9)", label="I2", component_name="V$IPROBE9"),
        VoltageRequest(expression="V(2)", label="Probe1-NODE", positive_node="2"),
    ]


@pytest.mark.parametrize("line", ["R1 1 2", ".PRINT I()", ".PRINT V(,)"])
def test_malformed_supported_lines_raise(line: str) -> None:
    with pytest.raises(NetlistParseError):
        parse_netlist(line)
