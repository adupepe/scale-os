const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const loader = $(".loader");
if (loader) {
  if (location.search.includes("shot")) {
    loader.remove();
  } else {
    const count = $(".loader__count");
    let progress = 0;
    const tick = setInterval(() => {
      progress = Math.min(100, progress + Math.ceil(Math.random() * 13));
      if (count) count.textContent = String(progress).padStart(2, "0");
      if (progress === 100) {
        clearInterval(tick);
        setTimeout(() => loader.classList.add("is-done"), 180);
      }
    }, 55);
  }
}

const menuToggle = $(".menu-toggle");
const navLinks = $(".product-nav__links");
if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.textContent = open ? "CLOSE" : "MENU";
  });
}

const canvas = $("#field");
if (canvas) {
  const ctx = canvas.getContext("2d");
  let points = [];
  let pointer = { x: -999, y: -999 };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    points = Array.from({ length: innerWidth < 700 ? 24 : 52 }, () => ({
      x: Math.random() * rect.width, y: Math.random() * rect.height,
      vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25
    }));
  };
  canvas.addEventListener("pointermove", event => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });
  canvas.addEventListener("pointerleave", () => pointer = { x: -999, y: -999 });
  const draw = () => {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    points.forEach(point => {
      point.x += point.vx; point.y += point.vy;
      if (point.x < 0 || point.x > rect.width) point.vx *= -1;
      if (point.y < 0 || point.y > rect.height) point.vy *= -1;
    });
    points.forEach((point, i) => {
      [...points.slice(i + 1), pointer].forEach(other => {
        const distance = Math.hypot(point.x - other.x, point.y - other.y);
        if (distance < 135) {
          ctx.strokeStyle = `rgba(95,255,231,${(1 - distance / 135) * .22})`;
          ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(other.x, other.y); ctx.stroke();
        }
      });
      ctx.fillStyle = "#5fffe7";
      ctx.fillRect(point.x, point.y, 2, 2);
    });
    requestAnimationFrame(draw);
  };
  resize(); draw();
  addEventListener("resize", resize);
}

const modelForm = $("#model-form");
if (modelForm) {
  const outputMap = { marketing: "%", price: "%", hires: "", churn: "%" };
  $$("input[type=range]", modelForm).forEach(input => {
    const output = $(`[data-output="${input.name}"]`);
    const update = () => output.textContent = `${input.value}${outputMap[input.name]}`;
    input.addEventListener("input", update); update();
  });

  let latestScenario = null;
  const runModel = async () => {
    const button = $("[data-run-model]");
    const state = $("[data-model-state]");
    button.disabled = true;
    if (state) state.textContent = "CALCULATING...";
    const payload = Object.fromEntries(new FormData(modelForm));
    try {
      const response = await fetch("/api/simulate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Simulation failed");
      latestScenario = { inputs: payload, result: data };
      const values = {
        "[data-projected]": `€${data.projected_arr}M`,
        "[data-growth]": `+${data.growth}%`,
        "[data-margin]": `${data.margin}%`,
        "[data-runway]": `${data.runway} MO`,
        "[data-confidence]": `${data.confidence}%`
      };
      Object.entries(values).forEach(([selector, value]) => { const el = $(selector); if (el) el.textContent = value; });
      if (state) state.textContent = "MODEL COMPLETE";
    } catch (error) {
      if (state) state.textContent = error.message.toUpperCase();
    } finally {
      button.disabled = false;
    }
  };
  $("[data-run-model]")?.addEventListener("click", runModel);
  $("[data-save-model]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    if (!latestScenario) await runModel();
    if (!latestScenario) return;
    const response = await fetch("/api/strategies", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(latestScenario)
    });
    const data = await response.json();
    button.textContent = data.ok ? `SAVED / ${data.reference}` : "SAVE FAILED";
  });
}

$$("[data-billing]").forEach(button => button.addEventListener("click", () => {
  $$("[data-billing]").forEach(item => item.classList.toggle("is-active", item === button));
  const annual = button.dataset.billing === "annual";
  $$("[data-price]").forEach(price => price.textContent = annual ? price.dataset.annual : price.dataset.monthly);
  $$("[data-period]").forEach(period => period.textContent = annual ? "/ month, billed annually" : "/ month");
}));
