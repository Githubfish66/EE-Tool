from __future__ import annotations

import re
from dataclasses import dataclass

import sympy as sp
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)


class ExpressionAnalysisError(ValueError):
    """Raised when an expression sandbox input cannot be parsed safely."""


@dataclass(frozen=True, slots=True)
class ExpressionAnalysisResult:
    original: sp.Expr
    substituted: sp.Expr
    simplified: sp.Expr
    factored: sp.Expr
    cancelled: sp.Expr
    symbols: list[str]


_IDENTIFIER_RE = re.compile(r"\b[A-Za-z_][A-Za-z0-9_]*\b")
_ENGINEERING_VALUE_RE = re.compile(
    r"(?<![A-Za-z_])(?P<number>\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?P<suffix>meg|[fpnumkgt])(?![A-Za-z_])",
    re.IGNORECASE,
)
_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application, convert_xor)
_ALLOWED_FUNCTIONS = {
    "exp": sp.exp,
    "sin": sp.sin,
    "cos": sp.cos,
    "tan": sp.tan,
    "sqrt": sp.sqrt,
    "log": sp.log,
    "Heaviside": sp.Heaviside,
}
_ENGINEERING_SUFFIXES = {
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


def analyze_expression(
    expression: str,
    substitutions: list[str],
) -> ExpressionAnalysisResult:
    original = parse_symbolic_expression(expression)
    substituted = original.subs(_parse_substitutions(substitutions, original))
    simplified = sp.simplify(substituted)
    factored = sp.factor(simplified)
    cancelled = sp.cancel(simplified)
    symbols = sorted(str(symbol) for symbol in original.free_symbols)
    return ExpressionAnalysisResult(
        original=original,
        substituted=sp.factor(sp.simplify(substituted)),
        simplified=simplified,
        factored=factored,
        cancelled=cancelled,
        symbols=symbols,
    )


def parse_symbolic_expression(expression: str) -> sp.Expr:
    normalized = _normalize_engineering_values(expression.strip())
    local_dict = _local_dict_for(normalized)
    try:
        return parse_expr(
            normalized,
            local_dict=local_dict,
            global_dict={
                "__builtins__": {},
                "Integer": sp.Integer,
                "Float": sp.Float,
                "Rational": sp.Rational,
                "Symbol": sp.Symbol,
            },
            transformations=_TRANSFORMATIONS,
            evaluate=True,
        )
    except Exception as exc:
        raise ExpressionAnalysisError(f"Could not parse expression: {expression!r}") from exc


def _parse_substitutions(lines: list[str], original: sp.Expr) -> dict[sp.Symbol, sp.Expr]:
    known_symbols = {str(symbol): symbol for symbol in original.free_symbols}
    substitutions: dict[sp.Symbol, sp.Expr] = {}

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if "=" not in line:
            raise ExpressionAnalysisError(f"Substitution must use '=': {line!r}")
        left, right = [part.strip() for part in line.split("=", maxsplit=1)]
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", left):
            raise ExpressionAnalysisError(f"Invalid substitution target: {left!r}")
        left_symbol = known_symbols.get(left, sp.Symbol(left))
        substitutions[left_symbol] = parse_symbolic_expression(right)

    return substitutions


def _local_dict_for(expression: str) -> dict[str, object]:
    tokens = set(_IDENTIFIER_RE.findall(expression))
    local_dict: dict[str, object] = dict(_ALLOWED_FUNCTIONS)
    for token in tokens:
        if token not in local_dict:
            local_dict[token] = sp.Symbol(token)
    return local_dict


def _normalize_engineering_values(expression: str) -> str:
    def replace(match: re.Match[str]) -> str:
        number = float(match.group("number"))
        suffix = match.group("suffix").lower()
        return f"({number * _ENGINEERING_SUFFIXES[suffix]})"

    return _ENGINEERING_VALUE_RE.sub(replace, expression)
