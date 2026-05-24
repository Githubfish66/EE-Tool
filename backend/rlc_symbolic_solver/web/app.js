const fileInput = document.querySelector("#fileInput");
const fileName = document.querySelector("#fileName");
const netlistText = document.querySelector("#netlistText");
const analyzeButton = document.querySelector("#analyzeButton");
const statusText = document.querySelector("#status");
const componentCount = document.querySelector("#componentCount");
const outputCount = document.querySelector("#outputCount");
const outputsList = document.querySelector("#outputsList");
const componentsTable = document.querySelector("#componentsTable");
const resultEmpty = document.querySelector("#resultEmpty");
const resultContent = document.querySelector("#resultContent");
const selectedBadge = document.querySelector("#selectedBadge");
const selectedTitle = document.querySelector("#selectedTitle");
const resultCards = document.querySelector("#resultCards");
const waveformPlot = document.querySelector("#waveformPlot");
const waveformStopInput = document.querySelector("#waveformStopInput");
const waveformResetButton = document.querySelector("#waveformResetButton");
const solveSelectedButton = document.querySelector("#solveSelectedButton");
const overlayModeButton = document.querySelector("#overlayModeButton");
const separateModeButton = document.querySelector("#separateModeButton");
const tabs = Array.from(document.querySelectorAll(".tab"));

let currentOutputs = [];
let currentFilter = "all";
let selectedOutputIds = new Set();
let waveformSeries = [];
let waveformView = null;
let waveformDrag = null;
let waveformMode = "overlay";
let currentResults = [];

const seriesColors = ["#0f766e", "#2563eb", "#b45309", "#be123c", "#6d28d9", "#047857"];

window.addEventListener("error", (event) => {
  setStatus(`App error: ${event.message}`, true);
});

window.addEventListener("unhandledrejection", (event) => {
  setStatus(`App error: ${event.reason?.message || event.reason}`, true);
});

fileInput?.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  fileName.textContent = file.name;
  netlistText.value = await file.text();
  await analyze();
});

analyzeButton?.addEventListener("click", analyze);
waveformResetButton?.addEventListener("click", () => {
  if (!waveformSeries.length) return;
  waveformView = defaultWaveformView(waveformSeries);
  drawWaveform();
});
solveSelectedButton?.addEventListener("click", solveSelected);
overlayModeButton?.addEventListener("click", () => setWaveformMode("overlay"));
separateModeButton?.addEventListener("click", () => setWaveformMode("separate"));

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    renderOutputs();
  });
});

async function analyze() {
  clearResult();
  setStatus("Analyzing netlist...");

  try {
    const data = await postJson("/api/analyze", { netlist: netlistText.value });
    currentOutputs = data.outputs;
    selectedOutputIds = new Set();
    componentCount.textContent = data.componentCount;
    outputCount.textContent = data.outputCount;
    renderOutputs();
    renderComponents(data.components);
    if (data.transientStopSeconds) {
      waveformStopInput.value = data.transientStopSeconds;
    }
    setStatus(`Found ${data.outputCount} output request(s).`);
  } catch (error) {
    currentOutputs = [];
    renderOutputs();
    renderComponents([]);
    componentCount.textContent = "0";
    outputCount.textContent = "0";
    setStatus(error.message, true);
  }
}

async function solveSelected() {
  const selections = Array.from(selectedOutputIds);
  if (!selections.length) {
    setStatus("Select at least one voltage or current output.", true);
    return;
  }
  setStatus("Solving selected output...");

  try {
    const payload = {
      netlist: netlistText.value,
      selections,
    };
    const waveformStopSeconds = Number(waveformStopInput.value);
    if (Number.isFinite(waveformStopSeconds) && waveformStopSeconds > 0) {
      payload.waveformStopSeconds = waveformStopSeconds;
    }
    const data = await postJson("/api/solve-many", payload);
    resultEmpty.classList.add("hidden");
    resultContent.classList.remove("hidden");
    selectedBadge.textContent = `${data.results.length} selected`;
    selectedTitle.textContent = data.results.map((result) => result.selected.label).join(", ");
    renderResultCards(data.results);
    renderWaveformSeries(data.results.map((result, index) => ({
      id: result.selected.id,
      label: result.selected.label,
      kind: result.selected.kind,
      color: seriesColors[index % seriesColors.length],
      points: result.waveform,
    })));
    renderComponents(data.components);
    typesetMath();
    setStatus("Solved.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderOutputs() {
  const visible = currentOutputs.filter((output) => currentFilter === "all" || output.kind === currentFilter);
  outputsList.classList.toggle("empty-state", visible.length === 0);

  if (visible.length === 0) {
    outputsList.textContent = currentOutputs.length === 0
      ? "Import a netlist to see voltage and current requests."
      : "No outputs match this filter.";
    return;
  }

  outputsList.textContent = "";
  visible.forEach((output) => {
    const item = document.createElement("article");
    item.className = "output-item";

    const copy = document.createElement("div");
    const title = document.createElement("div");
    title.className = "output-title";
    title.innerHTML = `<span class="badge">${escapeHtml(output.kind)}</span><span>${escapeHtml(output.label)}</span>`;

    const expression = document.createElement("div");
    expression.className = "output-expression";
    expression.textContent = output.expression;

    const detail = document.createElement("div");
    detail.className = "output-detail";
    detail.textContent = output.detail;

    copy.append(title, expression, detail);

    const control = document.createElement("label");
    control.className = "output-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedOutputIds.has(output.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedOutputIds.add(output.id);
      } else {
        selectedOutputIds.delete(output.id);
      }
    });
    control.append(checkbox, document.createTextNode("Select"));

    item.append(copy, control);
    outputsList.append(item);
  });
}

function renderResultCards(results) {
  currentResults = results;
  resultCards.textContent = "";
  results.forEach((result, index) => {
    const card = document.createElement("section");
    card.className = "result-output-card";
    card.innerHTML = `
      <div class="result-output-heading">
        <span class="series-swatch" style="background:${seriesColors[index % seriesColors.length]}"></span>
        <strong>${escapeHtml(result.selected.label)} (${escapeHtml(result.selected.expression)})</strong>
      </div>
      <div class="formula-grid">
        ${formulaBlock("S-domain symbolic", result.expressionLatex, result.expression)}
        ${formulaBlock("S-domain numeric", result.numericLatex, result.numeric)}
        ${formulaBlock("Time-domain symbolic", result.timeExpressionLatex, result.timeExpression || "")}
        ${formulaBlock("Time-domain numeric", result.timeNumericExpressionLatex, result.timeNumericExpression || "")}
      </div>
      <section class="expression-sandbox">
        <div class="sandbox-heading">
          <strong>Expression Sandbox</strong>
          <span>Substitute values or symbols, then simplify the expression again.</span>
        </div>
        <div class="sandbox-grid">
          <label>
            Substitutions
            <textarea class="sandbox-substitutions" data-result-index="${index}" placeholder="R1 = R2&#10;R4 = 10k&#10;V1 = 5"></textarea>
          </label>
          <button class="secondary-button sandbox-apply" type="button" data-result-index="${index}">Apply</button>
        </div>
        <div class="sandbox-output empty-state" id="sandboxOutput${index}">
          Enter substitutions, then apply.
        </div>
      </section>
    `;
    resultCards.append(card);
  });
  resultCards.querySelectorAll(".sandbox-apply").forEach((button) => {
    button.addEventListener("click", () => analyzeSandbox(Number(button.dataset.resultIndex)));
  });
}

function formulaBlock(label, latex, plainText) {
  return `
    <section class="formula-card">
      <label>${escapeHtml(label)}</label>
      <div class="math-box">${latex ? `\\[${latex}\\]` : "No closed-form expression."}</div>
      <details class="raw-expression">
        <summary>Plain text</summary>
        <pre>${escapeHtml(plainText)}</pre>
      </details>
    </section>
  `;
}

async function analyzeSandbox(index) {
  const result = currentResults[index];
  const output = document.querySelector(`#sandboxOutput${index}`);
  if (!result || !output) return;

  const substitutionsText = document.querySelector(`.sandbox-substitutions[data-result-index="${index}"]`)?.value || "";

  output.classList.remove("empty-state");
  output.textContent = "Analyzing expression...";

  try {
    const payload = {
      expression: result.expression,
      substitutions: substitutionsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    };
    const data = await postJson("/api/expression/analyze", payload);
    output.innerHTML = `
      <div class="sandbox-results">
        ${sandboxBlock("Substituted", data.substituted)}
        ${sandboxBlock("Simplified", data.simplified)}
        ${sandboxBlock("Factored", data.factored)}
        ${sandboxBlock("Cancelled", data.cancelled)}
      </div>
    `;
    typesetMath();
  } catch (error) {
    output.classList.add("empty-state");
    output.textContent = error.message;
  }
}

function sandboxBlock(label, expression) {
  return `
    <section class="sandbox-result-card">
      <label>${escapeHtml(label)}</label>
      <div class="math-box compact">\\[${expression.latex}\\]</div>
      <details class="raw-expression">
        <summary>Plain text</summary>
        <pre>${escapeHtml(expression.text)}</pre>
      </details>
    </section>
  `;
}

function setWaveformMode(mode) {
  waveformMode = mode;
  overlayModeButton.classList.toggle("active", mode === "overlay");
  separateModeButton.classList.toggle("active", mode === "separate");
  drawWaveform();
}

function renderWaveformSeries(series) {
  waveformSeries = series.filter((item) => item.points && item.points.length >= 2);
  waveformPlot.classList.toggle("empty-state", waveformSeries.length === 0);
  if (!waveformSeries.length) {
    waveformPlot.textContent = "No waveform points available.";
    return;
  }

  waveformView = defaultWaveformView(waveformSeries);
  drawWaveform();
}

function drawWaveform() {
  if (!waveformSeries.length || !waveformView) return;
  if (waveformMode === "separate") {
    drawSeparateWaveforms();
    return;
  }

  const width = 720;
  const height = 260;
  const margin = { left: 64, right: 18, top: 22, bottom: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xMin = waveformView.xMin;
  const xMax = waveformView.xMax;
  const plottedSeries = visibleSeriesPoints();
  const yValues = plottedSeries.flatMap((series) => series.points.map((point) => point.y));
  let yMin = Math.min(...yValues);
  let yMax = Math.max(...yValues);
  if (Math.abs(yMax - yMin) < 1e-15) {
    yMin -= 1;
    yMax += 1;
  }
  const yPadding = (yMax - yMin) * 0.08;
  yMin -= yPadding;
  yMax += yPadding;

  const scaleX = (value) => margin.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
  const scaleY = (value) => margin.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;
  const paths = plottedSeries.map((series) => {
    const path = series.points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.t).toFixed(2)} ${scaleY(point.y).toFixed(2)}`)
      .join(" ");
    return `<path class="wave-line" d="${path}" style="stroke:${series.color}"></path>`;
  }).join("");
  const legend = waveformSeries.map((series, index) =>
    `<g transform="translate(${margin.left + index * 112}, ${margin.top - 6})">
      <rect width="10" height="10" y="-8" rx="2" fill="${series.color}"></rect>
      <text class="axis-label" x="16" y="1">${escapeHtml(series.label)}</text>
    </g>`
  ).join("");
  const zeroY = yMin <= 0 && yMax >= 0 ? scaleY(0) : margin.top + plotHeight;

  waveformPlot.innerHTML = `
    <svg id="waveformSvg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Time-domain waveform">
      <rect class="plot-hitbox" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}"></rect>
      <line class="axis" x1="${margin.left}" y1="${zeroY}" x2="${width - margin.right}" y2="${zeroY}"></line>
      <line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>
      ${paths}
      <g>${legend}</g>
      <g id="waveformCursor" class="waveform-cursor hidden">
        <line id="cursorLine" x1="0" y1="${margin.top}" x2="0" y2="${height - margin.bottom}"></line>
        <circle id="cursorPoint" r="4"></circle>
        <rect id="cursorBubble" width="188" height="84" rx="8"></rect>
        <text id="cursorText"></text>
      </g>
      <text class="axis-label" x="${margin.left}" y="${height - 12}">t=${formatEngineering(xMin)}s</text>
      <text class="axis-label end" x="${width - margin.right}" y="${height - 12}">t=${formatEngineering(xMax)}s</text>
      <text class="axis-label" x="10" y="${scaleY(yMax) + 5}">${formatEngineering(yMax)}</text>
      <text class="axis-label" x="10" y="${scaleY(yMin) + 5}">${formatEngineering(yMin)}</text>
    </svg>
  `;
  attachWaveformInteractions({ width, height, margin, plotWidth, plotHeight, scaleX, scaleY });
}

function drawSeparateWaveforms() {
  waveformPlot.innerHTML = `<div class="separate-waveforms"></div>`;
  const container = waveformPlot.querySelector(".separate-waveforms");
  waveformSeries.forEach((series) => {
    const panel = document.createElement("div");
    panel.className = "separate-waveform-panel";
    panel.innerHTML = `<strong style="color:${series.color}">${escapeHtml(series.label)}</strong>${miniWaveformSvg(series)}`;
    container.append(panel);
  });
}

function miniWaveformSvg(series) {
  const width = 720;
  const height = 190;
  const margin = { left: 64, right: 18, top: 18, bottom: 34 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const visible = series.points.filter((point) => point.t >= waveformView.xMin && point.t <= waveformView.xMax);
  const points = visible.length >= 2 ? visible : series.points;
  const yValues = points.map((point) => point.y);
  let yMin = Math.min(...yValues);
  let yMax = Math.max(...yValues);
  if (Math.abs(yMax - yMin) < 1e-15) {
    yMin -= 1;
    yMax += 1;
  }
  const yPadding = (yMax - yMin) * 0.08;
  yMin -= yPadding;
  yMax += yPadding;
  const scaleX = (value) => margin.left + ((value - waveformView.xMin) / (waveformView.xMax - waveformView.xMin || 1)) * plotWidth;
  const scaleY = (value) => margin.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.t).toFixed(2)} ${scaleY(point.y).toFixed(2)}`)
    .join(" ");
  const zeroY = yMin <= 0 && yMax >= 0 ? scaleY(0) : margin.top + plotHeight;

  return `
    <svg class="mini-waveform" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(series.label)} waveform">
      <line class="axis" x1="${margin.left}" y1="${zeroY}" x2="${width - margin.right}" y2="${zeroY}"></line>
      <line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>
      <path class="wave-line" d="${path}" style="stroke:${series.color}"></path>
      <text class="axis-label" x="${margin.left}" y="${height - 10}">t=${formatEngineering(waveformView.xMin)}s</text>
      <text class="axis-label end" x="${width - margin.right}" y="${height - 10}">t=${formatEngineering(waveformView.xMax)}s</text>
      <text class="axis-label" x="10" y="${scaleY(yMax) + 5}">${formatEngineering(yMax)}</text>
      <text class="axis-label" x="10" y="${scaleY(yMin) + 5}">${formatEngineering(yMin)}</text>
    </svg>
  `;
}

function attachWaveformInteractions(context) {
  const svg = document.querySelector("#waveformSvg");
  const cursor = document.querySelector("#waveformCursor");
  const cursorLine = document.querySelector("#cursorLine");
  const cursorPoint = document.querySelector("#cursorPoint");
  const cursorBubble = document.querySelector("#cursorBubble");
  const cursorText = document.querySelector("#cursorText");
  if (!svg) return;

  svg.addEventListener("mousemove", (event) => {
    const point = svgPoint(svg, event);
    if (!insidePlot(point, context)) {
      cursor.classList.add("hidden");
      return;
    }
    const t = waveformView.xMin + ((point.x - context.margin.left) / context.plotWidth) * (waveformView.xMax - waveformView.xMin);
    const nearestValues = waveformSeries.map((series) => ({ series, point: nearestWaveformPoint(t, series.points) }));
    const primary = nearestValues[0];
    const x = context.scaleX(primary.point.t);
    const y = context.scaleY(primary.point.y);
    cursor.classList.remove("hidden");
    cursorLine.setAttribute("x1", x);
    cursorLine.setAttribute("x2", x);
    cursorPoint.setAttribute("cx", x);
    cursorPoint.setAttribute("cy", y);
    const bubbleX = Math.min(Math.max(x + 12, context.margin.left), context.width - context.margin.right - 188);
    const bubbleHeight = 30 + Math.min(nearestValues.length, 3) * 18;
    const bubbleY = Math.max(context.margin.top + 8, y - bubbleHeight - 10);
    cursorBubble.setAttribute("x", bubbleX);
    cursorBubble.setAttribute("y", bubbleY);
    cursorBubble.setAttribute("height", bubbleHeight);
    cursorText.setAttribute("x", bubbleX + 10);
    cursorText.setAttribute("y", bubbleY + 20);
    cursorText.innerHTML = `
      <tspan x="${bubbleX + 10}" dy="0">t = ${formatEngineering(primary.point.t)}s</tspan>
      ${nearestValues.slice(0, 3).map((item, index) =>
        `<tspan x="${bubbleX + 10}" dy="${18 * (index + 1)}">${escapeHtml(item.series.label)} = ${formatEngineering(item.point.y)}</tspan>`
      ).join("")}
    `;
  });

  svg.addEventListener("mouseleave", () => cursor.classList.add("hidden"));
  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    const point = svgPoint(svg, event);
    if (!insidePlot(point, context)) return;
    const t = waveformView.xMin + ((point.x - context.margin.left) / context.plotWidth) * (waveformView.xMax - waveformView.xMin);
    zoomWaveform(event.deltaY < 0 ? 0.75 : 1.35, t);
  }, { passive: false });

  svg.addEventListener("mousedown", (event) => {
    const point = svgPoint(svg, event);
    if (!insidePlot(point, context)) return;
    waveformDrag = { x: point.x, view: { ...waveformView } };
    svg.classList.add("dragging");
  });

  window.onmousemove = (event) => {
    if (!waveformDrag) return;
    const point = svgPoint(svg, event);
    const span = waveformDrag.view.xMax - waveformDrag.view.xMin;
    const dt = -((point.x - waveformDrag.x) / context.plotWidth) * span;
    setWaveformView(waveformDrag.view.xMin + dt, waveformDrag.view.xMax + dt);
    drawWaveform();
  };

  window.onmouseup = () => {
    waveformDrag = null;
    svg.classList.remove("dragging");
  };
}

function defaultWaveformView(series) {
  const allPoints = series.flatMap((item) => item.points);
  return { xMin: Math.min(...allPoints.map((point) => point.t)), xMax: Math.max(...allPoints.map((point) => point.t)) || 1 };
}

function zoomWaveform(factor, center) {
  const span = waveformView.xMax - waveformView.xMin;
  const nextSpan = Math.max(span * factor, fullWaveformSpan() / 1000);
  const ratio = (center - waveformView.xMin) / span;
  setWaveformView(center - nextSpan * ratio, center + nextSpan * (1 - ratio));
  drawWaveform();
}

function setWaveformView(xMin, xMax) {
  const allPoints = waveformSeries.flatMap((series) => series.points);
  const fullMin = Math.min(...allPoints.map((point) => point.t));
  const fullMax = Math.max(...allPoints.map((point) => point.t)) || 1;
  const fullSpan = fullMax - fullMin || 1;
  let span = Math.min(Math.max(xMax - xMin, fullSpan / 1000), fullSpan);
  if (xMin < fullMin) {
    xMin = fullMin;
    xMax = fullMin + span;
  }
  if (xMax > fullMax) {
    xMax = fullMax;
    xMin = fullMax - span;
  }
  waveformView = { xMin, xMax };
}

function fullWaveformSpan() {
  const allPoints = waveformSeries.flatMap((series) => series.points);
  return (Math.max(...allPoints.map((point) => point.t)) || 1) - (Math.min(...allPoints.map((point) => point.t)) || 0) || 1;
}

function nearestWaveformPoint(t, points) {
  return points.reduce((nearest, point) =>
    Math.abs(point.t - t) < Math.abs(nearest.t - t) ? point : nearest
  );
}

function visibleSeriesPoints() {
  return waveformSeries.map((series) => {
    const visible = series.points.filter((point) => point.t >= waveformView.xMin && point.t <= waveformView.xMax);
    return { ...series, points: visible.length >= 2 ? visible : series.points };
  });
}

function svgPoint(svg, event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

function insidePlot(point, context) {
  return point.x >= context.margin.left
    && point.x <= context.width - context.margin.right
    && point.y >= context.margin.top
    && point.y <= context.height - context.margin.bottom;
}

function renderCircuitGraph(components, schematicSvg = null) {
  circuitGraph.classList.toggle("empty-state", components.length === 0);
  if (!components.length) {
    circuitGraph.textContent = "Import a netlist to see how components are connected.";
    return;
  }

  if (schematicSvg) {
    circuitGraph.classList.remove("empty-state");
    circuitGraph.innerHTML = `<div class="schemdraw-stage">${schematicSvg}</div>`;
    return;
  }

  const ladder = buildLadderSchematic(components);
  if (ladder) {
    circuitGraph.innerHTML = renderLadderSchematic(ladder);
    return;
  }

  const nodes = Array.from(new Set(components.flatMap((component) => [
    component.positiveNode,
    component.negativeNode,
  ]))).sort((left, right) => {
    if (left === "0") return 1;
    if (right === "0") return -1;
    return left.localeCompare(right, undefined, { numeric: true });
  });
  const width = 900;
  const height = 420;
  const nodePositions = {};
  const nonGroundNodes = nodes.filter((node) => node !== "0");
  const leftX = 110;
  const rightX = width - 110;
  const topY = 76;
  const middleY = 190;
  const groundY = height - 58;
  const stepX = nonGroundNodes.length > 1 ? (rightX - leftX) / (nonGroundNodes.length - 1) : 0;

  nonGroundNodes.forEach((node, index) => {
    const connectedToGround = components.some((component) =>
      (component.positiveNode === node && component.negativeNode === "0")
      || (component.negativeNode === node && component.positiveNode === "0")
    );
    nodePositions[node] = {
      x: nonGroundNodes.length === 1 ? width / 2 : leftX + stepX * index,
      y: connectedToGround ? middleY : topY,
    };
  });

  if (nodes.includes("0")) {
    nodePositions["0"] = { x: width / 2, y: groundY };
  }

  const edgeGroups = new Map();
  components.forEach((component) => {
    const key = [component.positiveNode, component.negativeNode].sort().join("|");
    const count = edgeGroups.get(key) || 0;
    edgeGroups.set(key, count + 1);
  });

  const seenEdges = new Map();
  const edgeSvg = components.map((component) => {
    const start = nodePositions[component.positiveNode];
    const end = nodePositions[component.negativeNode];
    const key = [component.positiveNode, component.negativeNode].sort().join("|");
    const count = edgeGroups.get(key) || 1;
    const seen = seenEdges.get(key) || 0;
    seenEdges.set(key, seen + 1);
    const offset = (seen - (count - 1) / 2) * 26;
    return edgeMarkup(component, start, end, offset);
  }).join("");

  const nodeSvg = nodes.map((node) => {
    const point = nodePositions[node];
    const groundClass = node === "0" ? " ground-node" : "";
    return `
      <g class="graph-node${groundClass}" transform="translate(${point.x}, ${point.y})">
        <circle r="16"></circle>
        <text y="5">${escapeHtml(node)}</text>
      </g>
    `;
  }).join("");

  circuitGraph.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Circuit connectivity graph">
      <g>${edgeSvg}</g>
      <g>${nodeSvg}</g>
    </svg>
  `;
}

function buildLadderSchematic(components) {
  const nonProbeSources = components.filter((component) =>
    component.kind === "voltage_source" && Math.abs(Number(component.value)) > 0
  );
  const busCandidates = Array.from(new Set(components.flatMap((component) => [
    component.positiveNode,
    component.negativeNode,
  ]))).filter((node) => node !== "0");
  const busNode = busCandidates
    .map((node) => ({
      node,
      count: components.filter((component) =>
        component.positiveNode === node || component.negativeNode === node
      ).length,
    }))
    .sort((left, right) => right.count - left.count || left.node.localeCompare(right.node, undefined, { numeric: true }))[0]?.node;

  if (!busNode) {
    return null;
  }

  const branches = [];
  const used = new Set();

  nonProbeSources.forEach((source) => {
    const sourceTop = source.positiveNode === "0" ? source.negativeNode : source.positiveNode;
    const link = components.find((component) =>
      component.name !== source.name
      && component.kind !== "voltage_source"
      && connects(component, busNode, sourceTop)
    );
    if (!link) return;
    branches.push({
      type: "source",
      node: sourceTop,
      components: [link, source],
    });
    used.add(link.name);
    used.add(source.name);
  });

  components
    .filter((component) => !used.has(component.name) && touches(component, busNode))
    .forEach((first) => {
      const nextNode = otherNode(first, busNode);
      if (nextNode === "0") {
        branches.push({ type: "load", node: nextNode, components: [first] });
        used.add(first.name);
        return;
      }

      const groundComponent = components.find((component) =>
        !used.has(component.name)
        && component.name !== first.name
        && connects(component, nextNode, "0")
      );
      if (!groundComponent) return;
      branches.push({
        type: "load",
        node: nextNode,
        components: [first, groundComponent],
      });
      used.add(first.name);
      used.add(groundComponent.name);
    });

  if (branches.length < 2) {
    return null;
  }

  branches.sort((left, right) => {
    if (left.type !== right.type) return left.type === "source" ? -1 : 1;
    return branchLabel(left).localeCompare(branchLabel(right), undefined, { numeric: true });
  });

  return { busNode, branches };
}

function renderLadderSchematic(ladder) {
  const branchSpacing = 170;
  const width = Math.max(760, 150 + branchSpacing * (ladder.branches.length - 1) + 150);
  const height = 430;
  const topY = 72;
  const groundY = 338;
  const startX = 90;
  const endX = startX + branchSpacing * (ladder.branches.length - 1);
  const branchSvg = ladder.branches.map((branch, index) => {
    const x = startX + branchSpacing * index;
    return renderVerticalBranch(branch, x, topY, groundY);
  }).join("");
  const nodeSquares = ladder.branches.map((_, index) => {
    const x = startX + branchSpacing * index;
    return `<rect class="schematic-node" x="${x - 4}" y="${topY - 4}" width="8" height="8"></rect>
      <rect class="schematic-node" x="${x - 4}" y="${groundY - 4}" width="8" height="8"></rect>`;
  }).join("");

  return `
    <svg class="schematic-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Schematic-style circuit">
      ${dotGrid(width, height)}
      <path class="schematic-wire" d="M ${startX} ${topY} H ${endX} V ${groundY} H ${startX} Z"></path>
      ${nodeSquares}
      <g class="probe-label">
        <path d="M ${startX + 14} ${topY - 18} h 14 m -14 0 v -14"></path>
        <text x="${startX + 36}" y="${topY - 10}">Probe1-NODE</text>
      </g>
      ${branchSvg}
      ${groundSymbol(startX + branchSpacing, groundY + 24)}
    </svg>
  `;
}

function renderVerticalBranch(branch, x, topY, groundY) {
  const slots = branch.components.length === 1
    ? [(topY + groundY) / 2]
    : [topY + 78, groundY - 82];
  const pieces = branch.components.map((component, index) => {
    const y = slots[index];
    const symbol = verticalComponentSymbol(component, x, y);
    const labelX = x + 22;
    const label = component.kind === "voltage_source" && Number(component.value) === 0
      ? currentProbeLabel(component.name)
      : `${component.name}\n${component.value}`;
    return `${symbol}${multilineLabel(label, labelX, y - 10)}`;
  }).join("");

  return `
    <g class="schematic-branch">
      <line class="schematic-wire" x1="${x}" y1="${topY}" x2="${x}" y2="${groundY}"></line>
      ${pieces}
    </g>
  `;
}

function verticalComponentSymbol(component, x, y) {
  if (component.kind === "resistor") {
    const points = [
      [x, y - 34], [x - 8, y - 24], [x + 8, y - 14], [x - 8, y - 4],
      [x + 8, y + 6], [x - 8, y + 16], [x + 8, y + 26], [x, y + 34],
    ].map((point) => point.join(",")).join(" ");
    return `<polyline class="schematic-symbol" points="${points}"></polyline>`;
  }

  if (component.kind === "inductor") {
    const arcs = [-24, -8, 8, 24].map((offset) => {
      const y1 = y + offset - 8;
      const y2 = y + offset + 8;
      return `M ${x} ${y1} Q ${x + 18} ${y + offset} ${x} ${y2}`;
    }).join(" ");
    return `<path class="schematic-symbol" d="${arcs}"></path>`;
  }

  if (component.kind === "capacitor") {
    return `
      <line class="schematic-symbol" x1="${x - 18}" y1="${y - 8}" x2="${x + 18}" y2="${y - 8}"></line>
      <line class="schematic-symbol" x1="${x - 18}" y1="${y + 8}" x2="${x + 18}" y2="${y + 8}"></line>
    `;
  }

  if (component.kind === "voltage_source" && Number(component.value) === 0) {
    return `
      <path class="schematic-symbol" d="M ${x} ${y - 34} V ${y - 16}"></path>
      <path class="schematic-probe-arrow" d="M ${x} ${y - 4} V ${y + 28} m -8 -10 l 8 12 l 8 -12"></path>
    `;
  }

  if (component.kind === "voltage_source") {
    return `
      <circle class="schematic-symbol-fill" cx="${x}" cy="${y}" r="25"></circle>
      <line class="schematic-symbol" x1="${x - 22}" y1="${y - 36}" x2="${x + 22}" y2="${y - 36}"></line>
      <line class="schematic-symbol" x1="${x - 16}" y1="${y - 52}" x2="${x + 16}" y2="${y - 52}"></line>
    `;
  }

  return "";
}

function dotGrid(width, height) {
  const dots = [];
  for (let x = 10; x < width; x += 24) {
    for (let y = 14; y < height; y += 24) {
      dots.push(`<circle class="grid-dot" cx="${x}" cy="${y}" r="1"></circle>`);
    }
  }
  return `<g>${dots.join("")}</g>`;
}

function groundSymbol(x, y) {
  return `
    <g class="ground-symbol">
      <line x1="${x}" y1="${y - 12}" x2="${x}" y2="${y}"></line>
      <line x1="${x - 18}" y1="${y}" x2="${x + 18}" y2="${y}"></line>
      <line x1="${x - 12}" y1="${y + 8}" x2="${x + 12}" y2="${y + 8}"></line>
      <line x1="${x - 6}" y1="${y + 16}" x2="${x + 6}" y2="${y + 16}"></line>
    </g>
  `;
}

function multilineLabel(label, x, y) {
  const lines = label.split("\n");
  return `
    <text class="schematic-label" x="${x}" y="${y}">
      ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : 18}">${escapeHtml(line)}</tspan>`).join("")}
    </text>
  `;
}

function currentProbeLabel(name) {
  if (name.includes("IPROBE8")) return "I1";
  if (name.includes("IPROBE9")) return "I2";
  if (name.includes("IPROBE1")) return "I3";
  return name.replace("V$IPROBE", "I");
}

function branchLabel(branch) {
  return branch.components.map((component) => component.name).join("-");
}

function touches(component, node) {
  return component.positiveNode === node || component.negativeNode === node;
}

function connects(component, nodeA, nodeB) {
  return (component.positiveNode === nodeA && component.negativeNode === nodeB)
    || (component.positiveNode === nodeB && component.negativeNode === nodeA);
}

function otherNode(component, node) {
  return component.positiveNode === node ? component.negativeNode : component.positiveNode;
}

function edgeMarkup(component, start, end, offset) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const vertical = Math.abs(dx) < 18;
  const horizontal = Math.abs(dy) < 18;
  const midX = (start.x + end.x) / 2 + (vertical ? offset : 0);
  const midY = (start.y + end.y) / 2 + (horizontal ? offset : 0);
  const label = `${component.name} ${component.value}`;
  const labelWidth = Math.max(58, label.length * 7.1 + 14);
  const ux = vertical ? 0 : dx / length;
  const uy = vertical ? 1 : dy / length;
  const symbol = componentSymbolMarkup(component, midX, midY, ux, uy);
  const wirePath = orthogonalPath(start, end, offset);

  return `
    <g class="graph-edge">
      <path class="edge-wire" d="${wirePath}"></path>
      ${symbol}
      <rect
        x="${midX - labelWidth / 2}"
        y="${midY + 16}"
        width="${labelWidth}"
        height="26"
        rx="6"
      ></rect>
      <text x="${midX}" y="${midY + 34}">${escapeHtml(label)}</text>
    </g>
  `;
}

function orthogonalPath(start, end, offset) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 18 || Math.abs(dy) < 18) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
  const elbowY = (start.y + end.y) / 2 + offset;
  return `M ${start.x} ${start.y} L ${start.x} ${elbowY} L ${end.x} ${elbowY} L ${end.x} ${end.y}`;
}

function componentSymbolMarkup(component, x, y, ux, uy) {
  const normalX = -uy;
  const normalY = ux;
  const point = (along, normal = 0) => ({
    x: x + ux * along + normalX * normal,
    y: y + uy * along + normalY * normal,
  });

  if (component.kind === "resistor") {
    const points = [-34, -24, -16, -8, 0, 8, 16, 24, 34]
      .map((along, index) => point(along, index === 0 || index === 8 ? 0 : index % 2 === 0 ? -8 : 8))
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
    return `<polyline class="symbol-line" points="${points}"></polyline>`;
  }

  if (component.kind === "capacitor") {
    const plateA1 = point(-8, -16);
    const plateA2 = point(-8, 16);
    const plateB1 = point(8, -16);
    const plateB2 = point(8, 16);
    return `
      <line class="symbol-line" x1="${plateA1.x}" y1="${plateA1.y}" x2="${plateA2.x}" y2="${plateA2.y}"></line>
      <line class="symbol-line" x1="${plateB1.x}" y1="${plateB1.y}" x2="${plateB2.x}" y2="${plateB2.y}"></line>
    `;
  }

  if (component.kind === "inductor") {
    const arcs = [-18, -6, 6, 18].map((along) => {
      const start = point(along - 6, 0);
      const end = point(along + 6, 0);
      const control = point(along, -14);
      return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
    }).join(" ");
    return `<path class="symbol-line" d="${arcs}"></path>`;
  }

  if (component.kind === "voltage_source") {
    return `
      <circle class="symbol-fill" cx="${x}" cy="${y}" r="18"></circle>
      <text class="source-mark" x="${x}" y="${y - 3}">+</text>
      <text class="source-mark" x="${x}" y="${y + 13}">-</text>
    `;
  }

  return "";
}

function renderComponents(components) {
  if (!components.length) {
    componentsTable.innerHTML = '<tr><td colspan="4">No components loaded.</td></tr>';
    return;
  }

  componentsTable.textContent = "";
  components.forEach((component) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(component.name)}</td>
      <td>${escapeHtml(component.kind)}</td>
      <td>${escapeHtml(component.positiveNode)} to ${escapeHtml(component.negativeNode)}</td>
      <td>${escapeHtml(component.value)}</td>
    `;
    componentsTable.append(row);
  });
}

function clearResult() {
  resultEmpty.classList.remove("hidden");
  resultContent.classList.add("hidden");
  selectedBadge.textContent = "";
  selectedTitle.textContent = "";
  currentResults = [];
  resultCards.textContent = "";
  waveformSeries = [];
  waveformView = null;
  renderWaveformSeries([]);
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle("error", isError);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }

  if (!response.ok) {
    throw new Error(data.detail || `HTTP ${response.status}: ${response.statusText}`);
  }

  return data;
}

function typesetMath() {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([resultCards]).catch(() => {});
  }
}

function formatEngineering(value) {
  if (value === 0) return "0";
  const absValue = Math.abs(value);
  if (absValue >= 1e4 || absValue < 1e-3) {
    return value.toExponential(2);
  }
  return value.toPrecision(4);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

setStatus("App ready. Import or paste a netlist, then click Analyze outputs.");
