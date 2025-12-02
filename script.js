// ===== Snow / Ice particles on canvas =====
const canvas = document.getElementById("snowCanvas");
const ctx = canvas.getContext("2d");

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

window.addEventListener("resize", () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
});

const flakes = [];
const maxFlakes = 140;

function createFlake(extraBurst = false) {
  return {
    x: Math.random() * width,
    y: extraBurst ? height * 0.4 : Math.random() * height,
    radius: extraBurst ? 1 + Math.random() * 2 : 0.6 + Math.random() * 1.8,
    speedY: 0.5 + Math.random() * 1.5 + (extraBurst ? 1.2 : 0),
    speedX: (Math.random() - 0.5) * 0.4,
    alpha: 0.4 + Math.random() * 0.6
  };
}

// Initial snow
for (let i = 0; i < maxFlakes; i++) {
  flakes.push(createFlake(false));
}

function drawSnow() {
  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < flakes.length; i++) {
    const f = flakes[i];

    // Move
    f.y += f.speedY;
    f.x += f.speedX;

    // Wrap around
    if (f.y > height) {
      flakes[i] = createFlake(false);
      flakes[i].y = -5;
    }
    if (f.x > width + 5) f.x = -5;
    if (f.x < -5) f.x = width + 5;

    // Draw
    ctx.globalAlpha = f.alpha;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(220, 245, 255, 1)";
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  requestAnimationFrame(drawSnow);
}

drawSnow();

// Burst of extra icy shards during explode moment
function burstIceShards() {
  for (let i = 0; i < 60; i++) {
    flakes.push(
      Object.assign(createFlake(true), {
        x: width / 2 + (Math.random() - 0.5) * (width * 0.15),
        y: height / 2 + (Math.random() - 0.5) * (height * 0.15),
        speedX: (Math.random() - 0.5) * 3,
        speedY: 1 + Math.random() * 3,
        radius: 1 + Math.random() * 2
      })
    );
  }
}

// ===== Transition logic =====
const overlay = document.getElementById("overlay");
const christmasLogo = document.getElementById("christmasLogo");
const dayScreen = document.getElementById("dayScreen");

// Durations (ms)
const SHOW_CHRISTMAS = 4500;  // how long the Xmas logo sits
const EXPLODE_DURATION = 900; // shake / explode
const SHOW_ICY = 5000;        // how long the icy text sits
const LOOP_PAUSE = 1000;      // pause before restarting

function resetStates() {
  overlay.classList.remove("exploding", "icy");
  christmasLogo.classList.remove("shake", "breathe");
  dayScreen.classList.remove("breathe");

  christmasLogo.style.opacity = "1";
  dayScreen.style.opacity = "0";
}

function startSequence() {
  resetStates();

  // Idle breathing on Christmas logo
  christmasLogo.classList.add("breathe");

  // After some time, start explode
  setTimeout(() => {
    // shake + explode
    christmasLogo.classList.add("shake");
    overlay.classList.add("exploding");
    burstIceShards();

    // After explode animation, show icy screen
    setTimeout(() => {
      christmasLogo.classList.remove("breathe");
      overlay.classList.add("icy");
      dayScreen.classList.add("breathe");

      // After icy display time, fade out and restart loop
      setTimeout(() => {
        dayScreen.classList.remove("breathe");
        // quick fade out of icy
        dayScreen.style.opacity = "0";

        setTimeout(() => {
          startSequence();
        }, LOOP_PAUSE);
      }, SHOW_ICY);
    }, EXPLODE_DURATION);
  }, SHOW_CHRISTMAS);
}

// Start everything when images are loaded
if (christmasLogo.complete && dayScreen.complete) {
  startSequence();
} else {
  let loaded = 0;
  [christmasLogo, dayScreen].forEach(img => {
    img.addEventListener("load", () => {
      loaded++;
      if (loaded === 2) startSequence();
    });
  });
}
