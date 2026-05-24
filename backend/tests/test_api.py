from fastapi.testclient import TestClient

from rlc_symbolic_solver.api import app


CLIENT = TestClient(app)


EXAMPLE_NETLIST = """
V$IPROBE8 4 0 0.0
.PRINT I(V$IPROBE8)
.GRAPH IPROBE8#P curveLabel="I1"
V$IPROBE9 5 0 0.0
.PRINT I(V$IPROBE9)
.GRAPH IPROBE9#P curveLabel="I2"
R3 2 3 5
R4 2 4 2
R5 2 5 8
V2 3 0 5
"""


def test_analyze_netlist_returns_outputs_and_components() -> None:
    response = CLIENT.post("/api/analyze", json={"netlist": EXAMPLE_NETLIST})

    assert response.status_code == 200
    payload = response.json()
    assert payload["componentCount"] == 6
    assert payload["outputCount"] == 2
    assert payload["transientStopSeconds"] is None
    assert payload["outputs"][0] == {
        "id": "0",
        "label": "I1",
        "expression": "I(V$IPROBE8)",
        "kind": "current",
        "detail": "Current through V$IPROBE8",
    }


def test_solve_netlist_output_by_label() -> None:
    response = CLIENT.post(
        "/api/solve",
        json={"netlist": EXAMPLE_NETLIST, "selection": "I1", "waveformStopSeconds": 2e-6},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["selected"]["label"] == "I1"
    assert payload["expression"] == "R5*V2/(R3*R4 + R3*R5 + R4*R5)"
    assert payload["expressionLatex"] == "\\frac{R_{5} V_{2}}{R_{3} R_{4} + R_{3} R_{5} + R_{4} R_{5}}"
    assert payload["expressionPretty"]
    assert payload["numeric"] == "0.606060606060606"
    assert payload["numericLatex"] == "0.606060606060606"
    assert payload["timeNumericExpression"]
    assert payload["timeNumericExpressionLatex"]
    assert len(payload["waveform"]) > 10
    assert payload["waveform"][-1]["t"] == 2e-6


def test_solve_many_netlist_outputs() -> None:
    response = CLIENT.post(
        "/api/solve-many",
        json={"netlist": EXAMPLE_NETLIST, "selections": ["I1", "I2"], "waveformStopSeconds": 2e-6},
    )

    assert response.status_code == 200
    payload = response.json()
    assert [result["selected"]["label"] for result in payload["results"]] == ["I1", "I2"]
    assert len(payload["results"][0]["waveform"]) > 10
    assert payload["results"][1]["waveform"][-1]["t"] == 2e-6


def test_analyze_netlist_requires_outputs() -> None:
    response = CLIENT.post("/api/analyze", json={"netlist": "R1 1 0 10"})

    assert response.status_code == 400
    assert "No .PRINT" in response.json()["detail"]


def test_expression_analyze_endpoint() -> None:
    response = CLIENT.post(
        "/api/expression/analyze",
        json={
            "expression": "R2/(R1 + R2)",
            "substitutions": ["R2 = R1"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["simplified"]["text"] == "1/2"
    assert "approximation" not in payload
