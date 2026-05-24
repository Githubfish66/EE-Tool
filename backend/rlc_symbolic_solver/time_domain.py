from __future__ import annotations

from dataclasses import dataclass
from math import isfinite

import sympy as sp

from .components import Component, VoltageSource


@dataclass(frozen=True, slots=True)
class WaveformPoint:
    t: float
    y: float


@dataclass(frozen=True, slots=True)
class TimeDomainResult:
    symbolic_step_s: sp.Expr
    symbolic_time: sp.Expr
    numeric_step_s: sp.Expr
    numeric_time: sp.Expr
    waveform: list[WaveformPoint]


def solve_step_time_domain(
    expression_s: sp.Expr,
    components: list[Component],
    value_symbols: dict[str, sp.Symbol],
    stop_time_seconds: float | None,
    points: int = 240,
) -> TimeDomainResult:
    s = sp.Symbol("s")
    t = sp.Symbol("t", real=True, nonnegative=True)
    symbolic_step_s = _apply_step_sources(expression_s, components, value_symbols, numeric=False)
    numeric_step_s = _apply_step_sources(expression_s, components, value_symbols, numeric=True)

    symbolic_time = _inverse_laplace(symbolic_step_s, s, t)
    numeric_time = _inverse_laplace(numeric_step_s, s, t)
    waveform = sample_waveform(numeric_time, stop_time_seconds, points)

    return TimeDomainResult(
        symbolic_step_s=sp.factor(sp.simplify(symbolic_step_s)),
        symbolic_time=sp.simplify(symbolic_time),
        numeric_step_s=sp.factor(sp.simplify(numeric_step_s)),
        numeric_time=sp.simplify(numeric_time),
        waveform=waveform,
    )


def sample_waveform(expression_t: sp.Expr, stop_time_seconds: float | None, points: int = 240) -> list[WaveformPoint]:
    t = sp.Symbol("t", real=True, nonnegative=True)
    expression_t = expression_t.subs(sp.Heaviside(t), 1)
    stop_time = stop_time_seconds if stop_time_seconds and stop_time_seconds > 0 else 1e-3
    if points < 2:
        points = 2

    evaluator = sp.lambdify(t, expression_t, "math")
    samples: list[WaveformPoint] = []
    for index in range(points):
        current_t = stop_time * index / (points - 1)
        try:
            value = float(evaluator(current_t))
        except (TypeError, ValueError, ZeroDivisionError, OverflowError):
            continue
        if isfinite(value):
            samples.append(WaveformPoint(t=current_t, y=value))
    return samples


def _apply_step_sources(
    expression_s: sp.Expr,
    components: list[Component],
    value_symbols: dict[str, sp.Symbol],
    numeric: bool,
) -> sp.Expr:
    s = sp.Symbol("s")
    substitutions: dict[sp.Symbol, sp.Expr | float] = {}

    for component in components:
        symbol = value_symbols[component.name]
        if isinstance(component, VoltageSource) and component.value != 0:
            source_value: sp.Expr | float = component.value if numeric else symbol
            substitutions[symbol] = source_value / s
        elif numeric:
            substitutions[symbol] = component.value

    return expression_s.subs(substitutions)


def _inverse_laplace(expression_s: sp.Expr, s: sp.Symbol, t: sp.Symbol) -> sp.Expr:
    transformed = sp.inverse_laplace_transform(expression_s, s, t)
    return sp.simplify(transformed)
