from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ComponentKind(str, Enum):
    RESISTOR = "resistor"
    CAPACITOR = "capacitor"
    INDUCTOR = "inductor"
    VOLTAGE_SOURCE = "voltage_source"


class OutputKind(str, Enum):
    VOLTAGE = "voltage"
    CURRENT = "current"


@dataclass(frozen=True, slots=True)
class Component:
    name: str
    positive_node: str
    negative_node: str
    value: float
    kind: ComponentKind


@dataclass(frozen=True, slots=True)
class Resistor(Component):
    kind: ComponentKind = ComponentKind.RESISTOR


@dataclass(frozen=True, slots=True)
class Capacitor(Component):
    kind: ComponentKind = ComponentKind.CAPACITOR


@dataclass(frozen=True, slots=True)
class Inductor(Component):
    kind: ComponentKind = ComponentKind.INDUCTOR


@dataclass(frozen=True, slots=True)
class VoltageSource(Component):
    kind: ComponentKind = ComponentKind.VOLTAGE_SOURCE


@dataclass(frozen=True, slots=True)
class OutputRequest:
    expression: str
    label: str | None


@dataclass(frozen=True, slots=True)
class VoltageRequest(OutputRequest):
    positive_node: str
    negative_node: str = "0"
    kind: OutputKind = OutputKind.VOLTAGE


@dataclass(frozen=True, slots=True)
class CurrentRequest(OutputRequest):
    component_name: str
    kind: OutputKind = OutputKind.CURRENT
