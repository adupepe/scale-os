const $ = (selector) => document.querySelector(selector);
if (location.search.includes("shot")) document.documentElement.classList.add("capture");
if (location.search.includes("shot")) document.documentElement.classList.add("capture");
const $$ = (selector) => document.querySelectorAll(selector);
if (location.search.includes("shot")) document.documentElement.classList.add("capture");
const loaderValue = $("[data-loader]");
const pointer = $(".pointer");
const canvas = $("#field");
const ctx = canvas.getContext("2d");
const sliders = $$('input[type="range"]');
const result = $(".model__result");
const toast = $("[data-toast]");
let latestScenario = null;

let load = 0;
const loaderTimer = setInterval(() => {
  load = Math.min(100, load + Math.ceil(Math.random() * 12));
  loaderValue.textContent = String(load).padStart(2, "0");
  if (load === 100) clearInterval(loaderTimer);
}, 65);

window.addEventListener("pointermove", event => {
  pointer.style.left = `${event.clientX}px`;
  pointer.style.top = `${event.clientY}px`;
});

const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) {
    entry.target.classList.add("visible");
    observer.unobserve(entry.target);
  }
}), { threshold: .12 });
$$(".reveal").forEach(item => observer.observe(item));

function resizeCanvas() {
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const points = Array.from({ length: 58 }, (_, index) => ({
  x: Math.random(),
  y: Math.random(),
  vx: (Math.random() - .5) * .00016,
  vy: (Math.random() - .5) * .00016,
  hot: index % 9 === 0,
}));
function drawField() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  points.forEach(point => {
    point.x += point.vx;
    point.y += point.vy;
    if (point.x < 0 || point.x > 1) point.vx *= -1;
    if (point.y < 0 || point.y > 1) point.vy *= -1;
  });
  points.forEach((a, i) => points.slice(i + 1).forEach(b => {
    const dx = (a.x - b.x) * innerWidth;
    const dy = (a.y - b.y) * innerHeight;
    const distance = Math.hypot(dx, dy);
    if (distance < 160) {
      ctx.strokeStyle = `rgba(86,59,255,${(1 - distance / 160) * .32})`;
      ctx.beginPath();
      ctx.moveTo(a.x * innerWidth, a.y * innerHeight);
      ctx.lineTo(b.x * innerWidth, b.y * innerHeight);
      ctx.stroke();
    }
  }));
  points.forEach(point => {
    ctx.fillStyle = point.hot ? "#d8ff3e" : "#563bff";
    ctx.beginPath();
    ctx.arc(point.x * innerWidth, point.y * innerHeight, point.hot ? 3 : 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
  requestAnimationFrame(drawField);
}
drawField();

function sliderLabel(input) {
  const value = Number(input.value);
  if (input.name === "hires") return `+${value}`;
  if (input.name === "churn") return `−${(value / 10).toFixed(1)} pp`;
  return `${value >= 0 ? "+" : ""}${value}%`;
}
sliders.forEach(input => input.addEventListener("input", () => {
  document.querySelector(`[data-out="${input.name}"]`).textContent = sliderLabel(input);
}));

function payload() {
  return Object.fromEntries([...sliders].map(input => [input.name, Number(input.value)]));
}
async function runModel() {
  result.classList.add("calculating");
  $("[data-model-state]").textContent = "CALCULATING...";
  try {
    const response = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    latestScenario = { inputs: payload(), result: data };
    setTimeout(() => {
      $("[data-projected]").textContent = `${data.projected_arr.toFixed(2)}M`;
      $("[data-growth]").textContent = `${data.growth.toFixed(1)}%`;
      $("[data-margin]").textContent = `${data.margin.toFixed(1)}%`;
      $("[data-runway]").textContent = `${data.runway.toFixed(1)}M`;
      $("[data-confidence]").textContent = `${data.confidence}%`;
      $("[data-model-state]").textContent = "MODEL COMPLETE";
      result.classList.remove("calculating");
    }, 650);
  } catch (error) {
    $("[data-model-state]").textContent = `ERROR / ${error.message}`;
    result.classList.remove("calculating");
  }
}
$("[data-run-model]").addEventListener("click", runModel);
$("[data-scroll-sim]").addEventListener("click", () => $("#simulation").scrollIntoView());

$("[data-save]").addEventListener("click", async () => {
  const status = $("[data-save-status]");
  if (!latestScenario) await runModel();
  status.textContent = "> SAVING STRATEGY...";
  setTimeout(async () => {
    try {
      const response = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(latestScenario),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      status.textContent = `> SAVED / ${data.reference}`;
      toast.textContent = `STRATEGY ${data.reference} SAVED`;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 4000);
    } catch (error) {
      status.textContent = `> ERROR / ${error.message}`;
    }
  }, 700);
});

fetch("/api/metrics").then(response => response.json()).then(data => {
  $("[data-readiness]").textContent = data.readiness.toFixed(1);
  $("[data-revenue]").textContent = `${data.arr.toFixed(2)}M`;
}).catch(() => {});
