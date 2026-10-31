const COLORS = ["#4fa3f7", "#3390ec", "#ffd166", "#ef476f", "#06d6a0", "#c77dff", "#ffffff"];
const DURATION = 3400; // ms until the canvas is gone

type Piece = { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; color: string; round: boolean };

/**
 * A burst of confetti from both bottom corners, drawn on a throwaway canvas over the page.
 * The canvas lives on <body>, so it keeps falling across a client-side navigation.
 */
export function fireConfetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "9999" });
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = innerWidth;
  const height = innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);

  const pieces: Piece[] = [];
  const burst = (x: number, angle: number) => {
    for (let i = 0; i < 70; i++) {
      const a = angle + (Math.random() - 0.5) * 0.9;
      const speed = 11 + Math.random() * 11;
      pieces.push({
        x,
        y: height,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 5,
        r: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.25,
      });
    }
  };
  burst(0, -Math.PI / 3); // up and to the right
  burst(width, (-2 * Math.PI) / 3); // up and to the left

  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const elapsed = now - start;
    const dt = Math.min((now - last) / 16.67, 3); // 1 = one frame at 60 Hz, so 120 Hz screens aren't twice as fast
    last = now;
    ctx.clearRect(0, 0, width, height);
    const fade = Math.min(1, (DURATION - elapsed) / 800);

    for (const p of pieces) {
      p.vy += 0.35 * dt;
      p.vx *= Math.pow(0.992, dt);
      p.vy *= Math.pow(0.992, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(1, Math.abs(Math.cos(p.r * 1.3)) + 0.2); // tumbling: each piece flips edge-on as it spins
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }

    if (elapsed < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
