from __future__ import annotations

from dataclasses import dataclass

import sympy as sp

from .components import Component, CurrentRequest, OutputRequest, VoltageRequest
from .mna import build_mna_system
from .time_domain import TimeDomainResult, solve_step_time_domain


@dataclass(frozen=True, slots=True)
class SolveResult:
    expression: sp.Expr
    numeric_value: sp.Expr
    time_domain: TimeDomainResult | None = None


def solve_output(
    components: list[Component],
    output: OutputRequest,
    transient_stop_seconds: float | None = None,
    include_time_domain: bool = True,
) -> SolveResult:
    system = build_mna_system(components)
    solution = system.matrix.LUsolve(system.rhs)
    solution_by_symbol = dict(zip(system.unknowns, solution, strict=True))

    if isinstance(output, CurrentRequest):
        try:
            expression = solution_by_symbol[system.source_current_symbols[output.component_name]]
        except KeyError as exc:
            raise ValueError(
                f"Current output {output.expression!r} must reference an independent voltage source."
            ) from exc
    elif isinstance(output, VoltageRequest):
        positive = _node_voltage(output.positive_node, system.node_voltage_symbols, solution_by_symbol)
        negative = _node_voltage(output.negative_node, system.node_voltage_symbols, solution_by_symbol)
        expression = positive - negative
    else:
        raise TypeError(f"Unsupported output request: {output!r}")

    simplified = sp.factor(sp.simplify(expression))
    numeric_value = sp.N(simplified.subs(system.numeric_values))
    time_domain = None
    if include_time_domain:
        time_domain = solve_step_time_domain(
            simplified,
            components,
            system.value_symbols,
            transient_stop_seconds,
        )
    return SolveResult(expression=simplified, numeric_value=numeric_value, time_domain=time_domain)


def _node_voltage(
    node: str,
    node_voltage_symbols: dict[str, sp.Symbol],
    solution_by_symbol: dict[sp.Symbol, sp.Expr],
) -> sp.Expr:
    if node == "0":
        return sp.Integer(0)
    return solution_by_symbol[node_voltage_symbols[node]]
