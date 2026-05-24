import sympy as sp

from rlc_symbolic_solver.expression_tools import analyze_expression


def test_analyze_expression_applies_symbolic_substitution() -> None:
    result = analyze_expression("R1*R2/(R1 + R2)", ["R1 = R2"])

    R2 = sp.Symbol("R2")
    assert sp.simplify(result.simplified - R2 / 2) == 0


def test_analyze_expression_supports_engineering_suffix_values() -> None:
    result = analyze_expression("V1/R1", ["V1 = 5", "R1 = 10k"])

    assert result.simplified == sp.Float(0.0005)
