"use strict";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = DPR();
  if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, w: rect.width, h: rect.height };
}

function ellipsePoint(cx, cy, a, e, E) {
  const b = a * Math.sqrt(1 - e * e);
  return { x: cx + a * Math.cos(E), y: cy + b * Math.sin(E) };
}

function orbit(ctx, cx, cy, a, e, color = "#476884") {
  ctx.beginPath();
  ctx.ellipse(cx, cy, a, a * Math.sqrt(1 - e * e), 0, 0, TAU);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function dot(ctx, x, y, radius, color, glow = 0) {
  ctx.save();
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function label(ctx, text, x, y, color = "#a9bfd2", align = "center") {
  ctx.fillStyle = color;
  ctx.font = "12px Arial";
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".tab,.law-panel").forEach((element) => element.classList.remove("active"));
  button.classList.add("active");
  $(button.dataset.tab).classList.add("active");
  drawAll();
}));

document.querySelectorAll(".reveal").forEach((button) => button.addEventListener("click", () => {
  const answer = $(button.dataset.target);
  answer.hidden = !answer.hidden;
  button.textContent = answer.hidden ? "법칙 확인" : "설명 숨기기";
}));

$("fullscreen").addEventListener("click", () => (
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
));

// First law
let running1 = true;
let showOrbit1 = true;
let showFocus1 = true;
let showCenter1 = true;
let E1 = 0;

function toggleButton(id, state, text) {
  const button = $(id);
  button.classList.toggle("active", state);
  button.textContent = `${text} ${state ? "ON" : "OFF"}`;
}

$("eccentricity").addEventListener("input", (event) => {
  $("e-value").value = Number(event.target.value).toFixed(2);
  $("shape-note").textContent = +event.target.value === 0 ? "원 궤도" : "타원 궤도";
});
$("toggle1").onclick = () => {
  running1 = !running1;
  $("toggle1").textContent = running1 ? "⏸ 정지" : "▶ 시작";
};
$("orbit1").onclick = () => toggleButton("orbit1", showOrbit1 = !showOrbit1, "궤도");
$("focus1").onclick = () => toggleButton("focus1", showFocus1 = !showFocus1, "초점");
$("center1").onclick = () => toggleButton("center1", showCenter1 = !showCenter1, "중심");

function draw1() {
  const { ctx, w, h } = fitCanvas($("canvas1"));
  const e = +$("eccentricity").value;
  const a = Math.min(w * 0.34, h * 0.37);
  const cx = w / 2;
  const cy = h / 2;
  const c = a * e;
  if (showOrbit1) orbit(ctx, cx, cy, a, e);
  if (showFocus1) {
    dot(ctx, cx - c, cy, 4, "#ffc857");
    dot(ctx, cx + c, cy, 4, "#8da4b9");
    label(ctx, "F1 · 태양", cx - c, cy + 28, "#ffc857");
    label(ctx, "F2", cx + c, cy + 22);
  }
  if (showCenter1) {
    ctx.strokeStyle = "#9cb0c5";
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
    ctx.stroke();
    label(ctx, "타원의 중심", cx, cy - 13);
  }
  dot(ctx, cx - c, cy, 12, "#ffc857", 18);
  const planet = ellipsePoint(cx, cy, a, e, E1);
  dot(ctx, planet.x, planet.y, 8, "#55d8e6", 12);
  label(ctx, "행성", planet.x, planet.y - 15, "#8eeaf3");
  if (running1) E1 = (E1 + 0.008) % TAU;
}

// Second law: uniform mean anomaly means uniform swept area in uniform time.
const e2 = 0.62;
const MARK_COUNT = 10;
const MARK_INTERVAL = TAU / MARK_COUNT;
const MEAN_MOTION = 0.45; // radians per real second at 1× speed
let M2 = 0;
let running2 = false;
let speed2 = 1;
let marksVisible = false;
let velocityVisible = true;
let selectedIntervals = [];
let markerPositions = [];

function eccentricAnomaly(M, e) {
  let E = M;
  for (let i = 0; i < 8; i += 1) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

function advanceMeanAnomaly(meanAnomaly, elapsedSeconds, playbackSpeed = 1) {
  return (meanAnomaly + MEAN_MOTION * playbackSpeed * elapsedSeconds) % TAU;
}

function velocityAtE(a, e, E) {
  const b = a * Math.sqrt(1 - e * e);
  const denominator = 1 - e * Math.cos(E);
  return {
    x: -a * Math.sin(E) / denominator,
    y: b * Math.cos(E) / denominator
  };
}

function drawArrow(ctx, x, y, vx, vy, commonScale, options = {}) {
  const endX = x + vx * commonScale;
  const endY = y + vy * commonScale;
  const angle = Math.atan2(vy, vx);
  const color = options.color || "#61d6a4";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = options.width || 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - 8 * Math.cos(angle - 0.5), endY - 8 * Math.sin(angle - 0.5));
  ctx.lineTo(endX - 8 * Math.cos(angle + 0.5), endY - 8 * Math.sin(angle + 0.5));
  ctx.closePath();
  ctx.fill();
  if (options.text) label(ctx, options.text, endX, endY - 9, color);
  return Math.hypot(vx, vy) * commonScale;
}

function sectorPath(ctx, cx, cy, a, e, startM, endM) {
  const focusX = cx + a * e;
  ctx.beginPath();
  ctx.moveTo(focusX, cy);
  for (let i = 0; i <= 80; i += 1) {
    const M = startM + (endM - startM) * i / 80;
    const point = ellipsePoint(cx, cy, a, e, eccentricAnomaly(M % TAU, e));
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

// Independently integrates one selected sector and normalizes it by the ellipse area.
function relativeSectorArea(startM, interval = MARK_INTERVAL, samples = 400) {
  const a = 1;
  const b = Math.sqrt(1 - e2 * e2);
  const focus = { x: e2, y: 0 };
  let twiceArea = 0;
  let previous = focus;
  for (let i = 0; i <= samples; i += 1) {
    const M = startM + interval * i / samples;
    const E = eccentricAnomaly(M % TAU, e2);
    const current = { x: Math.cos(E), y: b * Math.sin(E) };
    twiceArea += previous.x * current.y - current.x * previous.y;
    previous = current;
  }
  twiceArea += previous.x * focus.y - focus.x * previous.y;
  return Math.abs(twiceArea / 2) / (Math.PI * a * b) * 100;
}

function updateAreaReadout() {
  const values = selectedIntervals.map((index) => relativeSectorArea(index * MARK_INTERVAL));
  $("area1").value = values[0] === undefined ? "—" : `전체의 ${values[0].toFixed(2)}%`;
  $("area2").value = values[1] === undefined ? "—" : `전체의 ${values[1].toFixed(2)}%`;
  if (!values.length) {
    $("area-compare").textContent = "빛나는 위치점 하나를 눌러 A1을 선택하세요.";
  } else if (values.length === 1) {
    $("area-compare").textContent = "다른 위치점을 눌러 A2를 선택하세요.";
  } else {
    const difference = Math.abs(values[0] - values[1]);
    const relativeDifference = difference / ((values[0] + values[1]) / 2) * 100;
    $("area-compare").textContent = `Δt₁ = Δt₂ · 상대 차이 ${relativeDifference.toFixed(3)}% · A1 ≈ A2`;
  }
}

$("play2").onclick = () => { running2 = true; };
$("pause2").onclick = () => { running2 = false; };
$("reset2").onclick = () => { M2 = 0; running2 = false; };
$("slow2").onclick = () => {
  speed2 = Math.max(0.25, speed2 / 2);
  $("speed-value").value = speed2.toFixed(2);
};
$("fast2").onclick = () => {
  speed2 = Math.min(4, speed2 * 2);
  $("speed-value").value = speed2.toFixed(2);
};
$("marks2").onclick = () => {
  marksVisible = !marksVisible;
  selectedIntervals = [];
  updateAreaReadout();
  $("marks2").classList.toggle("active", marksVisible);
  $("marks2").textContent = marksVisible ? "등시간 위치 숨기기" : "등시간 위치 표시";
};
$("velocity2").onclick = () => toggleButton("velocity2", velocityVisible = !velocityVisible, "속도 벡터");

function selectMarker(event) {
  if (!marksVisible) return;
  const rect = $("canvas2").getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  let closest = -1;
  let distance = 18;
  markerPositions.forEach((point, index) => {
    const candidate = Math.hypot(point.x - x, point.y - y);
    if (candidate < distance) {
      closest = index;
      distance = candidate;
    }
  });
  if (closest < 0) return;
  if (selectedIntervals.length >= 2) selectedIntervals = [];
  if (!selectedIntervals.includes(closest)) selectedIntervals.push(closest);
  updateAreaReadout();
}

$("canvas2").addEventListener("pointerdown", selectMarker);

function draw2() {
  const { ctx, w, h } = fitCanvas($("canvas2"));
  const a = Math.min(w * 0.32, h * 0.34);
  const b = a * Math.sqrt(1 - e2 * e2);
  const cx = w / 2;
  const cy = h / 2;
  const focusX = cx + a * e2;
  const perihelion = { x: cx + a, y: cy };
  const aphelion = { x: cx - a, y: cy };
  const maxVelocity = b / (1 - e2);
  const commonVectorScale = 44 / maxVelocity;

  orbit(ctx, cx, cy, a, e2);

  selectedIntervals.forEach((index, selection) => {
    const color = selection === 0 ? "#45d5dd55" : "#ff709655";
    sectorPath(ctx, cx, cy, a, e2, index * MARK_INTERVAL, (index + 1) * MARK_INTERVAL);
    ctx.fillStyle = color;
    ctx.fill();
    const middleM = (index + 0.5) * MARK_INTERVAL;
    const middle = ellipsePoint(cx, cy, a, e2, eccentricAnomaly(middleM % TAU, e2));
    label(ctx, selection === 0 ? "A1" : "A2", (focusX + middle.x) / 2, (cy + middle.y) / 2, selection === 0 ? "#7ef6ff" : "#ff9ab5");
  });

  markerPositions = [];
  if (marksVisible) {
    for (let index = 0; index < MARK_COUNT; index += 1) {
      const point = ellipsePoint(cx, cy, a, e2, eccentricAnomaly(index * MARK_INTERVAL, e2));
      markerPositions.push(point);
      const selected = selectedIntervals.includes(index);
      dot(ctx, point.x, point.y, selected ? 7 : 5, selected ? "#ffffff" : "#b8f8ff", selected ? 10 : 4);
      label(ctx, `${index + 1}`, point.x, point.y - 11, selected ? "#ffffff" : "#789fb8");
    }
    label(ctx, "모든 인접한 점 사이: Δt", cx, 25, "#b9f4fa");
  }

  label(ctx, "근일점", perihelion.x, perihelion.y - 18, "#ffc857");
  label(ctx, "원일점", aphelion.x, aphelion.y - 18, "#9cb0c5");
  dot(ctx, perihelion.x, perihelion.y, 3, "#ffc857");
  dot(ctx, aphelion.x, aphelion.y, 3, "#9cb0c5");
  dot(ctx, focusX, cy, 12, "#ffc857", 18);
  label(ctx, "태양", focusX, cy + 27, "#ffc857");

  if (velocityVisible) {
    drawArrow(ctx, perihelion.x, perihelion.y, 0, maxVelocity, commonVectorScale, { color: "#61d6a4", width: 2 });
    drawArrow(ctx, aphelion.x, aphelion.y, 0, -b / (1 + e2), commonVectorScale, { color: "#61d6a4", width: 2 });
  }

  const E = eccentricAnomaly(M2, e2);
  const planet = ellipsePoint(cx, cy, a, e2, E);
  ctx.strokeStyle = "#5f809c";
  ctx.beginPath();
  ctx.moveTo(focusX, cy);
  ctx.lineTo(planet.x, planet.y);
  ctx.stroke();
  dot(ctx, planet.x, planet.y, 8, "#55d8e6", 10);
  if (velocityVisible) {
    const velocity = velocityAtE(a, e2, E);
    drawArrow(ctx, planet.x, planet.y, velocity.x, velocity.y, commonVectorScale, { text: "속도" });
  }
}

const speedRatio = (1 + e2) / (1 - e2);
$("peri-speed").textContent = speedRatio.toFixed(2);
$("aphe-speed").textContent = "1.00";

// Third law
const planets = [
  ["수성", 0.387, 0.241],
  ["금성", 0.723, 0.615],
  ["지구", 1, 1],
  ["화성", 1.524, 1.881]
];
let calculated = false;
let relationVisible = false;

function renderTable() {
  $("planet-data").innerHTML = planets.map(([name, a, T]) => `<tr>
    <td>${name}</td><td>${a.toFixed(3)}</td><td>${T.toFixed(3)}</td>
    <td>${calculated ? (a ** 3).toFixed(3) : "—"}</td>
    <td>${calculated ? (T ** 2).toFixed(3) : "—"}</td>
    <td>${calculated ? (T * T / a ** 3).toFixed(3) : "—"}</td>
  </tr>`).join("");
}

$("calculate").onclick = () => {
  calculated = true;
  renderTable();
  $("calculate").textContent = "✓ 계산 완료";
  $("show-relation").disabled = false;
  $("graph-card").classList.remove("locked");
  $("graph-prompt").hidden = true;
  drawGraph();
};

$("show-relation").onclick = () => {
  relationVisible = !relationVisible;
  $("show-relation").textContent = relationVisible ? "관계선 숨기기" : "관계 확인하기";
  $("theory-label").hidden = !relationVisible;
  drawGraph();
};

$("new-a").oninput = (event) => {
  const a = +event.target.value;
  $("new-a-value").value = a.toFixed(2);
  $("new-t-value").value = Math.sqrt(a ** 3).toFixed(2);
  if (calculated) drawGraph();
};

function drawGraph() {
  const { ctx, w, h } = fitCanvas($("graph"));
  if (!calculated) return;
  const padding = 32;
  const max = 130;
  const X = (value) => padding + (w - padding - 8) * value / max;
  const Y = (value) => h - padding - (h - padding - 8) * value / max;
  ctx.strokeStyle = "#385069";
  ctx.fillStyle = "#7890a8";
  ctx.font = "10px Arial";
  for (let value = 0; value <= 120; value += 20) {
    ctx.beginPath(); ctx.moveTo(X(value), 8); ctx.lineTo(X(value), h - padding); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padding, Y(value)); ctx.lineTo(w - 8, Y(value)); ctx.stroke();
    ctx.fillText(value, X(value) - 5, h - 10);
    ctx.fillText(value, 5, Y(value) + 3);
  }
  if (relationVisible) {
    ctx.strokeStyle = "#55d8e6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    ctx.lineTo(X(max), Y(max));
    ctx.stroke();
  }
  planets.forEach(([name, a, T]) => {
    dot(ctx, X(a ** 3), Y(T ** 2), 5, "#ffc857");
    label(ctx, name, X(a ** 3) + 7, Y(T ** 2) - 7, "#fff", "left");
  });
  const a = +$("new-a").value;
  const value = a ** 3;
  ctx.save();
  ctx.translate(X(value), Y(value));
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#ff7096";
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();
  label(ctx, "새 행성", X(value) + 8, Y(value) - 8, "#ff9ab5", "left");
}

renderTable();

function drawAll() {
  if ($("law1").classList.contains("active")) draw1();
  if ($("law2").classList.contains("active")) draw2();
  if ($("law3").classList.contains("active")) drawGraph();
}

let previousTimestamp;
function animate(timestamp) {
  if (previousTimestamp === undefined) previousTimestamp = timestamp;
  const elapsedSeconds = (timestamp - previousTimestamp) / 1000;
  previousTimestamp = timestamp;
  if (running2) M2 = advanceMeanAnomaly(M2, elapsedSeconds, speed2);
  drawAll();
  requestAnimationFrame(animate);
}

window.addEventListener("resize", drawAll);
requestAnimationFrame(animate);

// Small, dependency-free hooks used by the numerical verification script.
window.keplerLab = { advanceMeanAnomaly, eccentricAnomaly, relativeSectorArea, velocityAtE };
