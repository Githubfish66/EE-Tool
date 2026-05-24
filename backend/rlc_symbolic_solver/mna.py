from __future__ import annotations

from dataclasses import dataclass

import sympy as sp

from .components import Capacitor, Component, Inductor, Resistor, VoltageSource


@dataclass(frozen=True, slots=True)
class MnaSystem:
    matrix: sp.Matrix
    rhs: sp.Matrix
    unknowns: list[sp.Symbol]
    node_voltage_symbols: dict[str, sp.Symbol]
    source_current_symbols: dict[str, sp.Symbol]
    value_symbols: dict[str, sp.Symbol]
    numeric_values: dict[sp.Symbol, float]


def build_mna_system(components: list[Component]) -> MnaSystem:
    nodes = sorted(
        {
            node
            for component in components
            for node in (component.positive_node, component.negative_node)
            if node != "0"
        }
    )
    voltage_sources = [component for component in components if isinstance(component, VoltageSource)]

    node_voltage_symbols = {node: sp.Symbol(f"V_{_safe_symbol_name(node)}") for node in nodes}
    source_current_symbols = {
        source.name: sp.Symbol(f"I_{_safe_symbol_name(source.name)}") for source in voltage_sources
    }
    value_symbols = {
        component.name: sp.Symbol(_safe_symbol_name(component.name)) for component in components
    }
    numeric_values = {value_symbols[component.name]: component.value for component in components}

    unknowns = list(node_voltage_symbols.values()) + list(source_current_symbols.values())
    size = len(unknowns)
    matrix = sp.zeros(size, size)
    rhs = sp.zeros(size, 1)
    node_index = {node: index for index, node in enumerate(nodes)}
    source_index = {
        source.name: len(nodes) + index for index, source in enumerate(voltage_sources)
    }
    s = sp.Symbol("s")

    for component in components:
        symbol = value_symbols[component.name]
        if isinstance(component, Resistor):
            _stamp_admittance(matrix, node_index, component.positive_node, component.negative_node, 1 / symbol)
        elif isinstance(component, Capacitor):
            _stamp_admittance(matrix, node_index, component.positive_node, component.negative_node, s * symbol)
        elif isinstance(component, Inductor):
            _stamp_admittance(matrix, node_index, component.positive_node, component.negative_node, 1 / (s * symbol))
        elif isinstance(component, VoltageSource):
            branch = source_index[component.name]
            _stamp_voltage_source(matrix, rhs, node_index, branch, component, symbol)

    return MnaSystem(
        matrix=matrix,
        rhs=rhs,
        unknowns=unknowns,
        node_voltage_symbols=node_voltage_symbols,
        source_current_symbols=source_current_symbols,
        value_symbols=value_symbols,
        numeric_values=numeric_values,
    )


def _stamp_admittance(
    matrix: sp.Matrix,
    node_index: dict[str, int],
    positive_node: str,
    negative_node: str,
    admittance: sp.Expr,
) -> None:
    positive = node_index.get(positive_node)
    negative = node_index.get(negative_node)

    if positive is not None:
        matrix[positive, positive] += admittance
    if negative is not None:
        matrix[negative, negative] += admittance
    if positive is not None and negative is not None:
        matrix[positive, negative] -= admittance
        matrix[negative, positive] -= admittance


def _stamp_voltage_source(
    matrix: sp.Matrix,
    rhs: sp.Matrix,
    node_index: dict[str, int],
    branch: int,
    source: VoltageSource,
    value_symbol: sp.Symbol,
) -> None:
    positive = node_index.get(source.positive_node)
    negative = node_index.get(source.negative_node)

    if positive is not None:
        matrix[positive, branch] += 1
        matrix[branch, positive] += 1
    if negative is not None:
        matrix[negative, branch] -= 1
        matrix[branch, negative] -= 1

    rhs[branch, 0] = 0 if source.value == 0 else value_symbol


def _safe_symbol_name(name: str) -> str:
    return "".join(character if character.isalnum() else "_" for character in name)
