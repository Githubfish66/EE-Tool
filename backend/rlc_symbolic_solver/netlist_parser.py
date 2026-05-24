from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from .components import (
    Capacitor,
    Component,
    CurrentRequest,
    Inductor,
    OutputRequest,
    Resistor,
    VoltageRequest,
    VoltageSource,
)


class NetlistParseError(ValueError):
    """Raised when a supported netlist line cannot be parsed."""


@dataclass(frozen=True, slots=True)
class ParsedNetlist:
    components: list[Component]
    outputs: list[OutputRequest]
    transient_stop_seconds: float | None = None


_COMPONENT_TYPES = {
    "R": Resistor,
    "C": Capacitor,
    "L": Inductor,
    "V": VoltageSource,
}

_VALUE_SUFFIXES = {
    "f": 1e-15,
    "p": 1e-12,
    "n": 1e-9,
    "u": 1e-6,
    "m": 1e-3,
    "k": 1e3,
    "meg": 1e6,
    "g": 1e9,
    "t": 1e12,
}

_PRINT_RE = re.compile(r"^\.PRINT\s+(.+)$", re.IGNORECASE)
_GRAPH_LABEL_RE = re.compile(r'curveLabel\s*=\s*(?:"([^"]+)"|([^\s]+))', re.IGNORECASE)


def parse_netlist(source: str) -> ParsedNetlist:
    components: list[Component] = []
    outputs: list[OutputRequest] = []
    transient_stop_seconds: float | None = None
    pending_output_index: int | None = None

    for line_number, raw_line in enumerate(source.splitlines(), start=1):
        line = _strip_inline_comment(raw_line).strip()
        if not line or line.startswith("*"):
            continue

        if line.upper().startswith(".PRINT"):
            output = _parse_print_line(line, line_number)
            outputs.append(output)
            pending_output_index = len(outputs) - 1
            continue

        if line.upper().startswith(".GRAPH"):
            if pending_output_index is not None:
                label = _parse_graph_label(line)
                if label:
                    outputs[pending_output_index] = _with_label(outputs[pending_output_index], label)
                    pending_output_index = None
            continue

        if line.upper().startswith(".TRAN"):
            transient_stop_seconds = _parse_tran_stop_time(line, line_number)
            continue

        if line.startswith(".") or line.startswith("+"):
            continue

        parts = line.split()
        name = parts[0]
        prefix = name[0].upper()
        component_type = _COMPONENT_TYPES.get(prefix)
        if component_type is None:
            continue

        if len(parts) != 4:
            raise NetlistParseError(
                f"Line {line_number}: {name} expects <positive_node> <negative_node> <value>."
            )

        components.append(
            component_type(
                name=name,
                positive_node=parts[1],
                negative_node=parts[2],
                value=_parse_value(parts[3], line_number),
            )
        )

    return ParsedNetlist(
        components=components,
        outputs=outputs,
        transient_stop_seconds=transient_stop_seconds,
    )


def parse_netlist_file(path: str | Path) -> ParsedNetlist:
    return parse_netlist(Path(path).read_text(encoding="utf-8"))


def _parse_print_line(line: str, line_number: int) -> OutputRequest:
    match = _PRINT_RE.match(line)
    if not match:
        raise NetlistParseError(f"Line {line_number}: invalid .PRINT line.")

    expression = match.group(1).strip()
    upper_expression = expression.upper()

    if upper_expression.startswith("I(") and expression.endswith(")"):
        component_name = expression[2:-1].strip()
        if not component_name:
            raise NetlistParseError(f"Line {line_number}: current output is missing a component name.")
        return CurrentRequest(expression=expression, label=None, component_name=component_name)

    if upper_expression.startswith("V(") and expression.endswith(")"):
        nodes = [node.strip() for node in expression[2:-1].split(",")]
        if len(nodes) == 1 and nodes[0]:
            return VoltageRequest(expression=expression, label=None, positive_node=nodes[0])
        if len(nodes) == 2 and nodes[0] and nodes[1]:
            return VoltageRequest(
                expression=expression,
                label=None,
                positive_node=nodes[0],
                negative_node=nodes[1],
            )
        raise NetlistParseError(f"Line {line_number}: voltage output has invalid nodes.")

    raise NetlistParseError(f"Line {line_number}: unsupported output expression {expression!r}.")


def _with_label(output: OutputRequest, label: str) -> OutputRequest:
    if isinstance(output, CurrentRequest):
        return CurrentRequest(
            expression=output.expression,
            label=label,
            component_name=output.component_name,
        )
    if isinstance(output, VoltageRequest):
        return VoltageRequest(
            expression=output.expression,
            label=label,
            positive_node=output.positive_node,
            negative_node=output.negative_node,
        )
    raise TypeError(f"Unsupported output request: {output!r}")


def _parse_graph_label(line: str) -> str | None:
    match = _GRAPH_LABEL_RE.search(line)
    if match:
        return match.group(1) or match.group(2)
    return None


def _parse_tran_stop_time(line: str, line_number: int) -> float | None:
    parts = line.split()
    for raw_value in parts[1:]:
        value = _parse_value(raw_value, line_number)
        if value > 0:
            return value
    return None


def _strip_inline_comment(line: str) -> str:
    return line.split(";", maxsplit=1)[0]


def _parse_value(raw_value: str, line_number: int) -> float:
    value = raw_value.strip()
    lower_value = value.lower()

    try:
        return float(value)
    except ValueError:
        pass

    for suffix, multiplier in sorted(_VALUE_SUFFIXES.items(), key=lambda item: len(item[0]), reverse=True):
        if lower_value.endswith(suffix):
            number = value[: -len(suffix)]
            try:
                return float(number) * multiplier
            except ValueError as exc:
                raise NetlistParseError(f"Line {line_number}: invalid value {raw_value!r}.") from exc

    raise NetlistParseError(f"Line {line_number}: invalid value {raw_value!r}.")
