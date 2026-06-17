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

let bodies = [];
let running = true;
let draggedBody = null;
let lastTime = performance.now();
let nextId = 1;

function defaultBodies() {
  return [
    { id: nextId++, name: 'Body 1', x: 420, y: 310, vx: 0, vy: -0.58, mass: 120, color: colors[0], trail: [] },
    { id: nextId++, name: 'Body 2', x: 560, y: 310, vx: 0, vy: 0.58, mass: 120, color: colors[1], trail: [] },
    { id: nextId++, name: 'Body 3', x: 490, y: 190, vx: 0.72, vy: 0, mass: 80, color: colors[2], trail: [] },
  ];
}

function resetSimulation() {
  nextId = 1;
  bodies = defaultBodies();
  renderControls();
}

function radiusFor(mass) {
  return Math.max(8, Math.sqrt(mass) * 1.25);
}

function addBody() {
  if (bodies.length >= maxBodies) return;
  const angle = (Math.PI * 2 * bodies.length) / maxBodies;
  const distance = 90 + bodies.length * 12;
  bodies.push({
    id: nextId,
    name: `Body ${nextId}`,
    x: canvas.width / 2 + Math.cos(angle) * distance,
    y: canvas.height / 2 + Math.sin(angle) * distance,
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
    if (body.x < 0 || body.x > canvas.width) body.vx *= -0.85;
    if (body.y < 0 || body.y > canvas.height) body.vy *= -0.85;
    body.x = Math.max(0, Math.min(canvas.width, body.x));
    body.y = Math.max(0, Math.min(canvas.height, body.y));
    body.trail.push({ x: body.x, y: body.y });
    if (body.trail.length > 140) body.trail.shift();
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  bodies.forEach((body) => {
    ctx.beginPath();
    body.trail.forEach((point, index) => {
      ctx.globalAlpha = index / body.trail.length * 0.42;
      index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = body.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    const radius = radiusFor(body.mass);
    const gradient = ctx.createRadialGradient(body.x - radius / 3, body.y - radius / 3, 2, body.x, body.y, radius * 1.8);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.18, body.color);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(body.x, body.y, radius * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(body.x, body.y, radius, 0, Math.PI * 2);
    ctx.fill();
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
  return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
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
  draggedBody.x = Math.max(0, Math.min(canvas.width, point.x));
  draggedBody.y = Math.max(0, Math.min(canvas.height, point.y));
  renderControls();
});

canvas.addEventListener('pointerup', (event) => {
  if (draggedBody) canvas.releasePointerCapture(event.pointerId);
  draggedBody = null;
  canvas.classList.remove('dragging');
});

playPause.addEventListener('click', () => {
  running = !running;
  playPause.textContent = running ? 'Pause' : 'Play';
});
resetButton.addEventListener('click', resetSimulation);
addBodyButton.addEventListener('click', addBody);

resetSimulation();
requestAnimationFrame(animationLoop);
