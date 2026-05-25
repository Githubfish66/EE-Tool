from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import sympy as sp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .components import Component, CurrentRequest, OutputKind, OutputRequest, VoltageRequest
from .expression_tools import ExpressionAnalysisError, analyze_expression
from .netlist_parser import NetlistParseError, ParsedNetlist, parse_netlist
from .solver import solve_output


class NetlistRequest(BaseModel):
    netlist: str = Field(min_length=1)


class SolveRequest(NetlistRequest):
    selection: str = Field(min_length=1)
    waveformStopSeconds: float | None = Field(default=None, gt=0)


class SolveManyRequest(NetlistRequest):
    selections: list[str] = Field(min_length=1)
    waveformStopSeconds: float | None = Field(default=None, gt=0)


class ExpressionAnalyzeRequest(BaseModel):
    expression: str = Field(min_length=1)
    substitutions: list[str] = []


@dataclass(frozen=True, slots=True)
class OutputSummary:
    id: str
    label: str
    expression: str
    kind: str
    detail: str


app = FastAPI(title="EE Tool RLC Symbolic Solver")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

DIST_DIR = Path(__file__).resolve().parents[2] / "dist"
ASSETS_DIR = DIST_DIR / "assets"
WEB_DIR = Path(__file__).resolve().parent / "web"
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")
if WEB_DIR.exists():
    app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")
    app.mount("/rlc-original", StaticFiles(directory=WEB_DIR, html=True), name="rlc-original")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def frontend_index() -> FileResponse:
    return _frontend_or_404()


@app.get("/rlc-original")
def rlc_original_index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


@app.post("/api/analyze")
def analyze_netlist(request: NetlistRequest) -> dict[str, Any]:
    parsed = _parse_or_400(request.netlist)
    outputs = [_summarize_output(index, output) for index, output in enumerate(parsed.outputs)]

    return {
        "componentCount": len(parsed.components),
        "outputCount": len(outputs),
        "outputs": [asdict(output) for output in outputs],
        "transientStopSeconds": parsed.transient_stop_seconds,
        "components": [_component_payload(component) for component in parsed.components],
    }


@app.post("/api/solve")
def solve_netlist_output(request: SolveRequest) -> dict[str, Any]:
    parsed = _parse_or_400(request.netlist)
    output = _find_output(parsed.outputs, request.selection)
    if output is None:
        raise HTTPException(status_code=404, detail=f"Unknown output selection: {request.selection}")

    result_payload = _solve_output_payload(parsed, output, request.waveformStopSeconds)
    result_payload["components"] = [_component_payload(component) for component in parsed.components]
    return result_payload


@app.post("/api/solve-many")
def solve_many_netlist_outputs(request: SolveManyRequest) -> dict[str, Any]:
    parsed = _parse_or_400(request.netlist)
    results: list[dict[str, Any]] = []

    for selection in request.selections:
        output = _find_output(parsed.outputs, selection)
        if output is None:
            raise HTTPException(status_code=404, detail=f"Unknown output selection: {selection}")
        results.append(_solve_output_payload(parsed, output, request.waveformStopSeconds))

    return {
        "results": results,
        "components": [_component_payload(component) for component in parsed.components],
    }


@app.post("/api/expression/analyze")
def analyze_symbolic_expression(request: ExpressionAnalyzeRequest) -> dict[str, Any]:
    try:
        result = analyze_expression(request.expression, request.substitutions)
    except ExpressionAnalysisError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "symbols": result.symbols,
        "substituted": _expression_payload(result.substituted),
        "simplified": _expression_payload(result.simplified),
        "factored": _expression_payload(result.factored),
        "cancelled": _expression_payload(result.cancelled),
    }


def _solve_output_payload(
    parsed: ParsedNetlist,
    output: OutputRequest,
    waveform_stop_seconds: float | None,
) -> dict[str, Any]:
    try:
        result = solve_output(
            parsed.components,
            output,
            waveform_stop_seconds or parsed.transient_stop_seconds,
        )
    except (KeyError, ValueError, ZeroDivisionError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    summary = _summarize_output(parsed.outputs.index(output), output)
    return {
        "selected": asdict(summary),
        "expression": sp.sstr(result.expression),
        "expressionLatex": sp.latex(result.expression),
        "expressionPretty": sp.pretty(result.expression),
        "numeric": sp.sstr(result.numeric_value),
        "numericLatex": sp.latex(result.numeric_value),
        "numericPretty": sp.pretty(result.numeric_value),
        "timeExpression": _time_expression_text(result.time_domain.symbolic_time if result.time_domain else None),
        "timeExpressionLatex": _time_expression_latex(result.time_domain.symbolic_time if result.time_domain else None),
        "timeNumericExpression": _time_expression_text(result.time_domain.numeric_time if result.time_domain else None),
        "timeNumericExpressionLatex": _time_expression_latex(
            result.time_domain.numeric_time if result.time_domain else None
        ),
        "waveform": [
            {"t": point.t, "y": point.y}
            for point in (result.time_domain.waveform if result.time_domain else [])
        ],
    }


def _parse_or_400(netlist: str) -> ParsedNetlist:
    try:
        parsed = parse_netlist(netlist)
    except NetlistParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not parsed.outputs:
        raise HTTPException(status_code=400, detail="No .PRINT voltage/current outputs were found.")

    return parsed


def _find_output(outputs: list[OutputRequest], selection: str) -> OutputRequest | None:
    for index, output in enumerate(outputs):
        summary = _summarize_output(index, output)
        if selection in {summary.id, output.expression, output.label}:
            return output
    return None


def _summarize_output(index: int, output: OutputRequest) -> OutputSummary:
    if isinstance(output, CurrentRequest):
        detail = f"Current through {output.component_name}"
    elif isinstance(output, VoltageRequest):
        if output.negative_node == "0":
            detail = f"Voltage at node {output.positive_node}"
        else:
            detail = f"Voltage from node {output.positive_node} to {output.negative_node}"
    else:
        detail = output.expression

    return OutputSummary(
        id=str(index),
        label=output.label or output.expression,
        expression=output.expression,
        kind=_kind_text(output.kind),
        detail=detail,
    )


def _kind_text(kind: OutputKind) -> str:
    if kind == OutputKind.CURRENT:
        return "current"
    if kind == OutputKind.VOLTAGE:
        return "voltage"
    return str(kind)


def _component_payload(component: Component) -> dict[str, str]:
    return {
        "name": component.name,
        "kind": component.kind.value,
        "positiveNode": component.positive_node,
        "negativeNode": component.negative_node,
        "value": f"{component.value:g}",
    }


def _time_expression_text(expression: sp.Expr | None) -> str | None:
    if expression is None:
        return None
    return sp.sstr(expression)


def _time_expression_latex(expression: sp.Expr | None) -> str | None:
    if expression is None:
        return None
    return sp.latex(expression)


def _expression_payload(expression: sp.Expr) -> dict[str, str]:
    return {
        "text": sp.sstr(expression),
        "latex": sp.latex(expression),
    }


@app.get("/{path:path}")
def frontend_fallback(path: str) -> FileResponse:
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found.")
    return _frontend_or_404()


def _frontend_or_404() -> FileResponse:
    index_path = DIST_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Frontend build was not found. Run npm run build first.")
    return FileResponse(index_path)
