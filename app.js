const canvas = document.querySelector('#simulation');
const ctx = canvas.getContext('2d');
const controls = document.querySelector('#bodyControls');
const bodyCount = document.querySelector('#bodyCount');
const playPause = document.querySelector('#playPause');
const resetButton = document.querySelector('#reset');
const addBodyButton = document.querySelector('#addBody');

const G = 0.075;
const softening = 90;
const maxBodies = 10;
const minBodies = 1;
const colors = ['#77e1ff', '#f7bf5b', '#ff6b8a', '#9cff8f', '#b796ff', '#ff9ee8', '#9df5d7', '#ffad7a', '#b9d7ff', '#d7ff7a'];
const fallbackWidth = 960;
const fallbackHeight = 620;
const stars = Array.from({ length: 120 }, (_, index) => ({
  x: (Math.sin(index * 91.7) + 1) / 2,
  y: (Math.cos(index * 47.3) + 1) / 2,
  r: 0.45 + (index % 4) * 0.22,
  alpha: 0.18 + (index % 5) * 0.09,
}));

let bodies = [];
let running = true;
let draggedBody = null;
let lastTime = performance.now();
let nextId = 1;

function simulationWidth() {
  return canvas.width || fallbackWidth;
}

function simulationHeight() {
  return canvas.height || fallbackHeight;
}

function makeBody(name, xRatio, yRatio, vx, vy, mass, color) {
  return {
    id: nextId++,
    name,
    x: simulationWidth() * xRatio,
    y: simulationHeight() * yRatio,
    vx,
    vy,
    mass,
    color,
    trail: [],
  };
}

function defaultBodies() {
  return [
    makeBody('Body 1', 0.39, 0.52, 0.05, -0.62, 135, colors[0]),
    makeBody('Body 2', 0.61, 0.52, -0.05, 0.62, 135, colors[1]),
    makeBody('Body 3', 0.50, 0.30, 0.78, 0, 90, colors[2]),
  ];
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width || fallbackWidth));
  const height = Math.max(280, Math.round(rect.height || fallbackHeight));
  if (canvas.width === width && canvas.height === height) return;

  const oldWidth = simulationWidth();
  const oldHeight = simulationHeight();
  canvas.width = width;
  canvas.height = height;

  if (!bodies.length) return;
  bodies.forEach((body) => {
    body.x = body.x / oldWidth * width;
    body.y = body.y / oldHeight * height;
    body.trail = body.trail.map((point) => ({
      x: point.x / oldWidth * width,
      y: point.y / oldHeight * height,
    }));
  });
}

function resetSimulation() {
  nextId = 1;
  resizeCanvas();
  bodies = defaultBodies();
  renderControls();
  draw();
}

function radiusFor(mass) {
  return Math.max(10, Math.sqrt(mass) * 1.45);
}

function addBody() {
  if (bodies.length >= maxBodies) return;
  const angle = (Math.PI * 2 * bodies.length) / maxBodies;
  const distance = Math.min(simulationWidth(), simulationHeight()) * (0.16 + bodies.length * 0.015);
  bodies.push({
    id: nextId,
    name: `Body ${nextId}`,
    x: simulationWidth() / 2 + Math.cos(angle) * distance,
    y: simulationHeight() / 2 + Math.sin(angle) * distance,
    vx: Math.sin(angle) * 0.35,
    vy: -Math.cos(angle) * 0.35,
    mass: 70,
    color: colors[(nextId - 1) % colors.length],
    trail: [],
  });
  nextId += 1;
  renderControls();
}

function removeBody(id) {
  if (bodies.length <= minBodies) return;
  bodies = bodies.filter((body) => body.id !== id);
  renderControls();
}

function renderControls() {
  bodyCount.textContent = `${bodies.length}/${maxBodies}`;
  addBodyButton.disabled = bodies.length >= maxBodies;
  controls.innerHTML = bodies.map((body) => `
    <article class="body-card">
      <div class="body-title">
        <strong><span class="swatch" style="color:${body.color};background:${body.color}"></span>${body.name}</strong>
        <button class="danger" type="button" data-remove="${body.id}" ${bodies.length <= minBodies ? 'disabled' : ''}>Remove</button>
      </div>
      <label>Mass <span class="value">${body.mass.toFixed(0)}</span>
        <input type="range" min="10" max="300" value="${body.mass}" data-mass="${body.id}" />
      </label>
      <label>Velocity X <span class="value">${body.vx.toFixed(2)}</span>
        <input type="range" min="-2" max="2" step="0.01" value="${body.vx}" data-vx="${body.id}" />
      </label>
      <label>Velocity Y <span class="value">${body.vy.toFixed(2)}</span>
        <input type="range" min="-2" max="2" step="0.01" value="${body.vy}" data-vy="${body.id}" />
      </label>
      <div class="coords"><span>x: ${body.x.toFixed(0)}</span><span>y: ${body.y.toFixed(0)}</span></div>
    </article>
  `).join('');
}

controls.addEventListener('input', (event) => {
  const input = event.target;
  const id = Number(input.dataset.mass || input.dataset.vx || input.dataset.vy);
  const body = bodies.find((candidate) => candidate.id === id);
  if (!body) return;
  if (input.dataset.mass) body.mass = Number(input.value);
  if (input.dataset.vx) body.vx = Number(input.value);
  if (input.dataset.vy) body.vy = Number(input.value);
  body.trail = [];
  renderControls();
});

controls.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove]');
  if (button) removeBody(Number(button.dataset.remove));
});

function update(dt) {
  const accelerations = bodies.map(() => ({ x: 0, y: 0 }));
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const dx = bodies[j].x - bodies[i].x;
      const dy = bodies[j].y - bodies[i].y;
      const distSq = dx * dx + dy * dy + softening;
      const dist = Math.sqrt(distSq);
      const force = G / distSq;
      accelerations[i].x += force * bodies[j].mass * dx / dist;
      accelerations[i].y += force * bodies[j].mass * dy / dist;
      accelerations[j].x -= force * bodies[i].mass * dx / dist;
      accelerations[j].y -= force * bodies[i].mass * dy / dist;
    }
  }

  bodies.forEach((body, index) => {
    body.vx += accelerations[index].x * dt;
    body.vy += accelerations[index].y * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    if (body.x < 0 || body.x > simulationWidth()) body.vx *= -0.85;
    if (body.y < 0 || body.y > simulationHeight()) body.vy *= -0.85;
    body.x = Math.max(0, Math.min(simulationWidth(), body.x));
    body.y = Math.max(0, Math.min(simulationHeight(), body.y));
    body.trail.push({ x: body.x, y: body.y });
    if (body.trail.length > 160) body.trail.shift();
  });
}

function drawBackground() {
  const width = simulationWidth();
  const height = simulationHeight();
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.48, 10, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
  gradient.addColorStop(0, '#102445');
  gradient.addColorStop(0.55, '#061124');
  gradient.addColorStop(1, '#02050d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  stars.forEach((star) => {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function draw() {
  resizeCanvas();
  ctx.clearRect(0, 0, simulationWidth(), simulationHeight());
  drawBackground();

  bodies.forEach((body) => {
    if (body.trail.length > 1) {
      ctx.beginPath();
      body.trail.forEach((point, index) => {
        ctx.globalAlpha = Math.max(0.08, index / body.trail.length * 0.55);
        index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = body.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const radius = radiusFor(body.mass);
    const glow = ctx.createRadialGradient(body.x, body.y, radius * 0.2, body.x, body.y, radius * 3.2);
    glow.addColorStop(0, body.color);
    glow.addColorStop(0.35, `${body.color}88`);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(body.x, body.y, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();

    const gradient = ctx.createRadialGradient(body.x - radius / 3, body.y - radius / 3, 2, body.x, body.y, radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.25, body.color);
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(body.x, body.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function animationLoop(now) {
  const dt = Math.min(24, now - lastTime) / 16.67;
  lastTime = now;
  if (running && !draggedBody) update(dt);
  draw();
  requestAnimationFrame(animationLoop);
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * simulationWidth() / rect.width, y: (event.clientY - rect.top) * simulationHeight() / rect.height };
}

canvas.addEventListener('pointerdown', (event) => {
  const point = pointerPosition(event);
  draggedBody = [...bodies].reverse().find((body) => Math.hypot(body.x - point.x, body.y - point.y) <= radiusFor(body.mass) + 8);
  if (draggedBody) {
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
    draggedBody.trail = [];
  }
});

canvas.addEventListener('pointermove', (event) => {
  if (!draggedBody) return;
  const point = pointerPosition(event);
  draggedBody.x = Math.max(0, Math.min(simulationWidth(), point.x));
  draggedBody.y = Math.max(0, Math.min(simulationHeight(), point.y));
  renderControls();
});

canvas.addEventListener('pointerup', (event) => {
  if (draggedBody) canvas.releasePointerCapture(event.pointerId);
  draggedBody = null;
  canvas.classList.remove('dragging');
});

window.addEventListener('resize', resizeCanvas);

playPause.addEventListener('click', () => {
  running = !running;
  playPause.textContent = running ? 'Pause' : 'Play';
});
resetButton.addEventListener('click', resetSimulation);
addBodyButton.addEventListener('click', addBody);

resetSimulation();
requestAnimationFrame(animationLoop);
