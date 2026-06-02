const timeEl = document.querySelector("#time");
const dateEl = document.querySelector("#date");
const greetingEl = document.querySelector("#greeting");
const quoteEl = document.querySelector("#quote");
const canvas = document.querySelector("#ambient-canvas");
const context = canvas.getContext("2d");

const settings = {
  theme: localStorage.getItem("ambient-clock-theme") || "aurora",
  showSeconds: localStorage.getItem("ambient-clock-seconds") === "true",
  use24Hour: localStorage.getItem("ambient-clock-24h") !== "false",
  soundOn: false,
};

const quotes = [
  "把注意力轻轻放回此刻。",
  "今天只需要做好下一件小事。",
  "慢下来，代码也会更清楚。",
  "给思路一点安静的空间。",
  "保持呼吸，保持好奇。",
];

let audioContext;
let ambientNodes;
let width = 0;
let height = 0;
let particles = [];

function pad(value) {
  return String(value).padStart(2, "0");
}

function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const hourLabel = settings.use24Hour
    ? pad(hours)
    : String(hours % 12 || 12).padStart(2, "0");

  timeEl.textContent = settings.showSeconds
    ? `${hourLabel}:${minutes}:${seconds}`
    : `${hourLabel}:${minutes}`;

  dateEl.textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);

  const period = hours < 6 ? "夜深了" : hours < 11 ? "早上好" : hours < 14 ? "中午好" : hours < 18 ? "下午好" : "晚上好";
  greetingEl.textContent = period;
}

function setQuote() {
  const dayIndex = Math.floor(Date.now() / 86400000) % quotes.length;
  quoteEl.textContent = quotes[dayIndex];
}

function resizeCanvas() {
  const scale = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  buildParticles();
}

function buildParticles() {
  const count = Math.max(24, Math.min(70, Math.floor((width * height) / 28000)));
  particles = Array.from({ length: count }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 2 + Math.random() * 7,
    speed: 0.12 + Math.random() * 0.34,
    phase: Math.random() * Math.PI * 2,
    hueShift: index % 3,
  }));
}

function themeColors() {
  const theme = document.body.dataset.theme;
  if (theme === "dawn") return ["rgba(255, 227, 154, ", "rgba(139, 216, 255, ", "rgba(255, 159, 127, "];
  if (theme === "midnight") return ["rgba(137, 216, 255, ", "rgba(217, 180, 255, ", "rgba(143, 255, 210, "];
  if (theme === "forest") return ["rgba(200, 255, 141, ", "rgba(255, 208, 129, ", "rgba(132, 213, 178, "];
  return ["rgba(116, 255, 196, ", "rgba(255, 210, 131, ", "rgba(156, 167, 255, "];
}

function drawAmbient(time) {
  context.clearRect(0, 0, width, height);
  const colors = themeColors();
  const pulse = Math.sin(time / 2600) * 0.5 + 0.5;

  const wash = context.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.74);
  wash.addColorStop(0, `rgba(255, 255, 255, ${0.08 + pulse * 0.05})`);
  wash.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);

  particles.forEach((particle) => {
    particle.y -= particle.speed;
    particle.x += Math.sin(time / 1800 + particle.phase) * 0.18;
    if (particle.y < -20) {
      particle.y = height + 20;
      particle.x = Math.random() * width;
    }

    const alpha = 0.12 + (Math.sin(time / 900 + particle.phase) * 0.5 + 0.5) * 0.2;
    const gradient = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.radius * 7);
    gradient.addColorStop(0, `${colors[particle.hueShift]}${alpha})`);
    gradient.addColorStop(1, `${colors[particle.hueShift]}0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius * 7, 0, Math.PI * 2);
    context.fill();
  });

  requestAnimationFrame(drawAmbient);
}

function applyTheme(theme) {
  settings.theme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem("ambient-clock-theme", theme);
  document.querySelectorAll(".theme-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeValue === theme);
  });
}

function updateToggleStates() {
  document.querySelector("#format-toggle").textContent = settings.use24Hour ? "24" : "12";
  document.querySelector("#format-toggle").classList.toggle("active", !settings.use24Hour);
  document.querySelector("#seconds-toggle").classList.toggle("active", settings.showSeconds);
  document.querySelector("#sound-toggle").classList.toggle("active", settings.soundOn);
  document.body.classList.toggle("with-seconds", settings.showSeconds);
}

function startAmbientSound() {
  audioContext = audioContext || new AudioContext();
  const low = audioContext.createOscillator();
  const high = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  low.type = "sine";
  high.type = "triangle";
  low.frequency.value = 92;
  high.frequency.value = 146;
  filter.type = "lowpass";
  filter.frequency.value = 420;
  gain.gain.value = 0.018;

  low.connect(filter);
  high.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  low.start();
  high.start();
  ambientNodes = { low, high, gain };
}

function stopAmbientSound() {
  if (!ambientNodes) return;
  ambientNodes.gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.08);
  setTimeout(() => {
    ambientNodes.low.stop();
    ambientNodes.high.stop();
    ambientNodes = null;
  }, 220);
}

document.querySelectorAll(".theme-button").forEach((button) => {
  button.addEventListener("click", () => applyTheme(button.dataset.themeValue));
});

document.querySelector("#format-toggle").addEventListener("click", () => {
  settings.use24Hour = !settings.use24Hour;
  localStorage.setItem("ambient-clock-24h", String(settings.use24Hour));
  updateClock();
  updateToggleStates();
});

document.querySelector("#seconds-toggle").addEventListener("click", () => {
  settings.showSeconds = !settings.showSeconds;
  localStorage.setItem("ambient-clock-seconds", String(settings.showSeconds));
  updateClock();
  updateToggleStates();
});

document.querySelector("#sound-toggle").addEventListener("click", async () => {
  settings.soundOn = !settings.soundOn;
  if (settings.soundOn) {
    startAmbientSound();
  } else {
    stopAmbientSound();
  }
  updateToggleStates();
});

document.querySelector("#fullscreen-toggle").addEventListener("click", async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await document.documentElement.requestFullscreen();
  }
});

window.addEventListener("resize", resizeCanvas);

applyTheme(settings.theme);
setQuote();
updateClock();
updateToggleStates();
resizeCanvas();
setInterval(updateClock, 1000);
requestAnimationFrame(drawAmbient);
