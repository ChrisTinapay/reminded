"use client";

import React, { useEffect, useMemo, useRef } from "react";

export type CriticalMassStatus = "idle" | "polling" | "completed" | "error";

type Props = {
  status: CriticalMassStatus;
  /** 0..1 (best-effort). Rendered as an in-game “reactor charge” HUD. */
  progress?: number;
  /** Optional short label like "queued" | "processing" */
  phaseLabel?: string;
  /** Optional ETA in seconds (best-effort). */
  etaSeconds?: number;
  /** Show the gameplay hint text inside the canvas. */
  showHint?: boolean;
  className?: string;
};

type Shockwave = {
  id: number;
  x: number;
  y: number;
  r: number;
  vr: number;
  alpha: number;
};

type GameState = {
  rafId: number | null;
  tPrev: number;

  dpr: number;
  w: number;
  h: number;

  // Hourglass animation
  sandLevel: number; // 0..1 (0 = empty bottom, 1 = full bottom)
  score: number;
  combo: number; // 1x, 2x, 3x...
  perfectTextUntil: number; // ms timestamp
  clickPulseUntil: number; // ms timestamp (visual feedback on tap)

  // Shake / critical zone
  criticalZone: number; // threshold for bottom bulb fullness
  shake: { x: number; y: number }; // low-pass shake offset

  // Rotation / flip animation (instead of instant reset)
  angle: number; // radians
  rotating: boolean;
  rotT: number; // 0..1 progress
  rotDurationMs: number;
  rotFrom: number;
  rotTo: number;
  pendingFlipPerfect: boolean;
  pendingFlip: boolean;

  // Shockwaves
  nextShockId: number;
  shockwaves: Shockwave[];

  // Processing HUD (smoothed)
  hudProgress: number; // 0..1

  // Cached layout
  cx: number;
  cy: number;
  hgW: number;
  hgH: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function CriticalMassGame({
  status,
  progress = 0,
  phaseLabel,
  etaSeconds,
  showHint = true,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const hudRef = useRef<{ progress: number; phaseLabel?: string; etaSeconds?: number }>({
    progress: 0,
    phaseLabel: undefined,
    etaSeconds: undefined,
  });

  const colors = useMemo(
    () => ({
      bg: "#131312",
      outline: "rgba(99, 102, 241, 0.38)", // indigo-ish brand outline
      outlineStrong: "rgba(99, 102, 241, 0.70)",
      sand: "rgba(255, 255, 255, 0.78)",
      sandDim: "rgba(255, 255, 255, 0.42)",
      stream: "rgba(255, 255, 255, 0.28)",
      ui: "rgba(255,255,255,0.82)",
      uiDim: "rgba(255,255,255,0.55)",
      perfect: "rgba(167, 139, 250, 0.95)", // violet
      shock: "rgba(59, 130, 246, 0.75)", // blue
      hudBase: "rgba(255,255,255,0.12)",
      hudTick: "rgba(255,255,255,0.20)",
      hudText: "rgba(255,255,255,0.62)",
    }),
    [],
  );

  // Update HUD refs whenever props change (without restarting the loop).
  useEffect(() => {
    hudRef.current = {
      progress: clamp(progress, 0, 1),
      phaseLabel,
      etaSeconds,
    };
  }, [progress, phaseLabel, etaSeconds]);

  useEffect(() => {
    if (status !== "polling") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const getDpr = () =>
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const init = () => {
      const dpr = getDpr();
      stateRef.current = {
        rafId: null,
        tPrev: performance.now(),
        dpr,
        w: 0,
        h: 0,
        sandLevel: 0,
        score: 0,
        combo: 1,
        perfectTextUntil: 0,
        clickPulseUntil: 0,
        criticalZone: 0.82,
        shake: { x: 0, y: 0 },
        angle: 0,
        rotating: false,
        rotT: 0,
        rotDurationMs: 380,
        rotFrom: 0,
        rotTo: 0,
        pendingFlipPerfect: false,
        pendingFlip: false,
        nextShockId: 1,
        shockwaves: [],
        hudProgress: 0,
        cx: 0,
        cy: 0,
        hgW: 0,
        hgH: 0,
      };
      resize();
    };

    const resize = () => {
      const s = stateRef.current;
      if (!s) return;

      const rect = canvas.getBoundingClientRect();
      s.dpr = getDpr();
      s.w = Math.max(1, Math.floor(rect.width * s.dpr));
      s.h = Math.max(1, Math.floor(rect.height * s.dpr));
      canvas.width = s.w;
      canvas.height = s.h;

      const portrait = s.h > s.w * 1.08;

      // Layout: center hourglass, sized to fit.
      s.cx = s.w * 0.5;

      // Reserve space for the processing HUD when on small/portrait screens.
      const margin = 18 * s.dpr;
      const hudR = clamp(Math.min(s.w, s.h) * 0.14, 62 * s.dpr, 120 * s.dpr);
      const hudPanelH = portrait ? (hudR * 2 + margin * 2 + 54 * s.dpr) : 0;
      const bottomSafe = portrait ? 78 * s.dpr : 54 * s.dpr; // keep text away from bottom nav

      // Shorter, less “tower-like” hourglass proportions.
      const maxHgH = Math.max(160 * s.dpr, Math.min(320 * s.dpr, (s.h - hudPanelH - bottomSafe) * 0.78));
      s.hgH = clamp(s.h * 0.52, 150 * s.dpr, maxHgH);
      s.hgW = clamp(s.hgH * 0.46, 120 * s.dpr, 240 * s.dpr);

      // Place hourglass lower on portrait screens so the HUD can live above it.
      const minCy = hudPanelH > 0 ? hudPanelH + s.hgH * 0.5 + 10 * s.dpr : 0;
      s.cy = portrait ? Math.max(s.h * 0.58, minCy) : s.h * 0.52;
    };

    /**
     * Non-linear sand flow math:
     * - sandLevel increases 0→1 (top empties / bottom fills).
     * - Flow accelerates as top empties: as sandLevel increases, ds/dt increases.
     * - Use a smooth curve: rate = base * (0.35 + 0.65 * sandLevel^2)
     *   (gentle early, faster near the end).
     */
    const computeSandFlowRate = (sandLevel: number, dpr: number) => {
      // Fast, game-like cycle: ~3–5s per fill depending on perfect flips.
      const base = 1;
      // Stronger non-linearity so it noticeably accelerates near the end.
      const accel = 0.25 + 0.95 * sandLevel * sandLevel * sandLevel;
      // Slight dpr influence so high DPI doesn't feel slower.
      return base * accel * (dpr >= 2 ? 1.1 : 1.0);
    };

    /**
     * Tap/click flips the hourglass.
     * - If we're in the critical zone (vibrating), it's a Perfect flip:
     *   spawn shockwave + increase score + combo.
     * - Otherwise, it's a normal flip (no shockwave), and combo resets to 1x.
     */
    const flip = (perfect: boolean) => {
      const s = stateRef.current;
      if (!s) return;
      // Visual feedback on any interaction.
      s.clickPulseUntil = performance.now() + 220;

      // If already rotating, ignore additional flips to keep it calm.
      if (s.rotating) return;

      // Queue the flip: we rotate first, then reset sand at the end.
      s.pendingFlip = true;
      s.pendingFlipPerfect = perfect;
      s.rotating = true;
      s.rotT = 0;
      s.rotFrom = s.angle;
      s.rotTo = s.angle + Math.PI; // 180° rotation
    };

    const onClickOrTouch = (e: Event) => {
      e.preventDefault();
      const s = stateRef.current;
      if (!s) return;
      const inCritical = s.sandLevel >= s.criticalZone && s.sandLevel < 1;
      flip(inCritical);
    };

    canvas.addEventListener("click", onClickOrTouch, { passive: false });
    canvas.addEventListener("touchstart", onClickOrTouch, { passive: false });

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const update = (tNow: number) => {
      const s = stateRef.current;
      if (!s) return;
      const dt = clamp((tNow - s.tPrev) / 1000, 0, 0.05);
      s.tPrev = tNow;

      // Smooth the external HUD progress so it feels “in-world”.
      const targetHud = clamp(hudRef.current.progress ?? 0, 0, 1);
      const kHud = 1 - Math.pow(1 - 0.14, dt * 60); // frame-rate independent
      s.hudProgress += (targetHud - s.hudProgress) * kHud;

      // Rotation animation (ease-in-out).
      if (s.rotating) {
        const dur = Math.max(160, s.rotDurationMs);
        s.rotT = clamp(s.rotT + (dt * 1000) / dur, 0, 1);
        const t = s.rotT;
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        s.angle = s.rotFrom + (s.rotTo - s.rotFrom) * ease;

        // Pause sand flow while rotating (keeps it readable).
        if (s.rotT >= 1) {
          s.rotating = false;
          // Normalize angle to keep values bounded.
          s.angle = ((s.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

          if (s.pendingFlip) {
            // Apply perfect reward now that the flip "lands".
            if (s.pendingFlipPerfect) {
              s.score += 10 * s.combo;
              s.combo = Math.min(99, s.combo + 1);
              s.perfectTextUntil = performance.now() + 650;
              s.shockwaves.push({
                id: s.nextShockId++,
                x: s.cx,
                y: s.cy,
                r: 0,
                vr: 520 * s.dpr,
                alpha: 1,
              });
            } else {
              s.combo = 1;
            }

            // After rotation, reset sand to start another run.
            s.sandLevel = 0;
            s.pendingFlip = false;
            s.pendingFlipPerfect = false;
          }
        }
      } else {
        // Sand flow progression (only when not rotating).
        const rate = computeSandFlowRate(s.sandLevel, s.dpr);
        s.sandLevel = clamp(s.sandLevel + rate * dt, 0, 1);
      }

      // Soft failure: when bottom reaches 100%, combo breaks and auto-flip.
      if (s.sandLevel >= 1) {
        // Auto-flip with no shockwave, but with rotation.
        s.combo = 1;
        flip(false);
      }

      // Critical zone shake: slight randomized vibration when near full.
      // We low-pass filter random offsets to avoid harsh jitter.
      const inCritical = s.sandLevel >= s.criticalZone;
      const targetAmp = inCritical ? 5.0 * s.dpr : 0;
      const tx = (Math.random() - 0.5) * targetAmp;
      const ty = (Math.random() - 0.5) * targetAmp;
      const k = 0.22; // smoothing (slightly snappier)
      s.shake.x += (tx - s.shake.x) * k;
      s.shake.y += (ty - s.shake.y) * k;

      // Shockwave particle system (expanding rings).
      const keep: Shockwave[] = [];
      for (const sw of s.shockwaves) {
        sw.r += sw.vr * dt;
        sw.alpha = clamp(sw.alpha - 1.15 * dt, 0, 1);
        if (sw.alpha > 0.02 && sw.r < Math.max(s.w, s.h) * 1.2) keep.push(sw);
      }
      s.shockwaves = keep;
    };

    /**
     * Sand polygons:
     * We model each bulb as a triangle with its apex at the pinch center.
     *
     * Top bulb:
     * - Remaining fraction fTop = 1 - sandLevel.
     * - In similar triangles, area ∝ (heightFraction)^2.
     * - Therefore heightFraction = sqrt(fTop).
     * - A triangle whose apex is at the pinch and base is at yBase fills that area.
     *
     * Bottom bulb:
     * - Filled fraction fBot = sandLevel.
     * - heightFraction = sqrt(fBot), growing down from the pinch.
     */
    const draw = () => {
      const s = stateRef.current;
      if (!s) return;

      // Background.
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, s.w, s.h);

      // Hourglass geometry (centered).
      const hgW = s.hgW;
      const hgH = s.hgH;
      const x0 = s.cx - hgW / 2;
      const y0 = s.cy - hgH / 2;
      const pinchX = s.cx;
      const pinchY = s.cy;

      const portrait = s.h > s.w * 1.08;

      // Apply shake + rotation to the drawing coordinates only (visual vibration / flip).
      const drawX = s.shake.x;
      const drawY = s.shake.y;

      // Outline hourglass (two intersecting triangles / trapezoids).
      // Outer shape: diamond-ish hourglass.
      const outlineW = hgW;
      const outlineH = hgH;

      // Sand levels.
      // IMPORTANT:
      // `sandLevel` is defined in the *visual* orientation:
      // - sandLevel = 0 => top bulb full, bottom bulb empty (as the user sees it)
      // - sandLevel = 1 => top bulb empty, bottom bulb full (as the user sees it)
      //
      // We rotate the entire hourglass around the pinch center. After a 180° rotation,
      // the *local* top/bottom triangles swap positions on screen. To keep the sand
      // always starting in the visible top bulb (and ending in the visible bottom bulb),
      // we swap which local bulb gets which fraction based on whether we're flipped.
      const twoPi = Math.PI * 2;
      const a = ((s.angle % twoPi) + twoPi) % twoPi;
      const flipped = Math.round(a / Math.PI) % 2 === 1; // ~0 or ~π

      // Visual fractions:
      const fTopVisual = clamp(1 - s.sandLevel, 0, 1);
      const fBotVisual = clamp(s.sandLevel, 0, 1);

      // Local fractions (before rotation):
      const fTop = flipped ? fBotVisual : fTopVisual;
      const fBot = flipped ? fTopVisual : fBotVisual;

      // Bulb heights (half/half).
      const bulbH = outlineH / 2;

      // Top bulb sand triangle (apex at pinch, base above pinch).
      const topHeightFrac = Math.sqrt(fTop);
      const topSandH = bulbH * topHeightFrac;
      const topBaseY = pinchY - topSandH;
      const topBaseW = outlineW * (topSandH / bulbH);

      // Bottom bulb sand triangle (apex at pinch, base below pinch).
      const botHeightFrac = Math.sqrt(fBot);
      const botSandH = bulbH * botHeightFrac;
      const botBaseY = pinchY + botSandH;
      const botBaseW = outlineW * (botSandH / bulbH);

      // Draw shockwaves behind hourglass.
      for (const sw of s.shockwaves) {
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.75 * sw.alpha})`;
        ctx.lineWidth = 2.2 * s.dpr;
        ctx.stroke();
      }

      // Draw sand (top + bottom).
      ctx.save();
      ctx.translate(pinchX + drawX, pinchY + drawY);
      ctx.rotate(s.angle);
      ctx.translate(-(pinchX), -(pinchY));

      // Bottom sand (growing).
      if (fBot > 0) {
        ctx.beginPath();
        ctx.moveTo(pinchX, pinchY);
        ctx.lineTo(pinchX - botBaseW / 2, botBaseY);
        ctx.lineTo(pinchX + botBaseW / 2, botBaseY);
        ctx.closePath();
        ctx.fillStyle = colors.sand;
        ctx.fill();
      }

      // Top sand (shrinking).
      if (fTop > 0) {
        ctx.beginPath();
        ctx.moveTo(pinchX, pinchY);
        ctx.lineTo(pinchX - topBaseW / 2, topBaseY);
        ctx.lineTo(pinchX + topBaseW / 2, topBaseY);
        ctx.closePath();
        ctx.fillStyle = colors.sandDim;
        ctx.fill();
      }

      // Stream line through the pinch center.
      ctx.beginPath();
      ctx.moveTo(pinchX, pinchY - 2 * s.dpr);
      ctx.lineTo(pinchX, pinchY + 2 * s.dpr);
      ctx.strokeStyle = colors.stream;
      ctx.lineWidth = 1 * s.dpr;
      ctx.stroke();

      // Hourglass outline (faint brand color).
      ctx.beginPath();
      // Top trapezoid/triangle
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + outlineW, y0);
      ctx.lineTo(pinchX, pinchY);
      // Bottom trapezoid/triangle
      ctx.lineTo(x0 + outlineW, y0 + outlineH);
      ctx.lineTo(x0, y0 + outlineH);
      ctx.lineTo(pinchX, pinchY);
      ctx.closePath();
      ctx.strokeStyle =
        s.sandLevel >= s.criticalZone ? colors.outlineStrong : colors.outline;
      // Thicker outline.
      ctx.lineWidth = 3.6 * s.dpr;
      ctx.stroke();

      ctx.restore();

      // --- Processing HUD (reactor charge gauge) ---
      // We compute placement early so other UI can avoid overlapping it.
      const hudLayout = (() => {
        const margin = 18 * s.dpr;
        const small = Math.min(s.w, s.h) < 430 * s.dpr;
        const r = clamp(
          Math.min(s.w, s.h) * (portrait ? 0.12 : 0.14),
          54 * s.dpr,
          portrait ? 92 * s.dpr : 120 * s.dpr,
        );
        const cx = portrait ? s.w * 0.5 : s.w - margin - r;
        const cy = margin + r;
        return { margin, small, r, cx, cy };
      })();

      // UI text (score + combo) positioned to avoid HUD.
      {
        const leftX = 16 * s.dpr;
        const topPad = 14 * s.dpr;
        // On portrait, HUD sits near top-center; move score/combo below its footprint.
        const yMin =
          portrait ? hudLayout.cy + hudLayout.r + 16 * s.dpr : topPad;
        const y0Text = yMin;

        ctx.fillStyle = colors.ui;
        ctx.font = `${12 * s.dpr}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`Score ${s.score}`, leftX, y0Text);

        ctx.fillStyle = colors.uiDim;
        ctx.fillText(`Combo ${s.combo}x`, leftX, y0Text + 20 * s.dpr);
      }

      // Perfect! indicator.
      const now = performance.now();
      if (s.perfectTextUntil > now) {
        const a = clamp((s.perfectTextUntil - now) / 650, 0, 1);
        ctx.fillStyle = `rgba(167, 139, 250, ${a})`;
        ctx.font = `700 ${18 * s.dpr}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Perfect!", s.cx, y0 - 18 * s.dpr);
      }

      // Subtle instruction (optional).
      if (showHint) {
        const instrY = Math.min(s.h - 14 * s.dpr, y0 + outlineH + 26 * s.dpr);
        ctx.fillStyle = "rgba(255,255,255,0.40)";
        ctx.font = `${11 * s.dpr}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("Tap during vibration for Perfect flip", s.cx, instrY);
      }

      // --- Processing HUD (reactor charge gauge) ---
      {
        const p = clamp(s.hudProgress, 0, 1);
        const phase = hudRef.current.phaseLabel;
        const eta = hudRef.current.etaSeconds;

        const { r, cx: gaugeCx, cy: gaugeCy, small } = hudLayout;

        // Base arc (nearly full circle, with a small gap).
        const a0 = Math.PI * 0.10;
        const a1 = Math.PI * 1.90;
        const span = a1 - a0;
        const endA = a0 + span * p;

        // Subtle “glass” backing.
        ctx.beginPath();
        ctx.arc(gaugeCx, gaugeCy, r, a0, a1);
        ctx.strokeStyle = colors.hudBase;
        ctx.lineWidth = 8 * s.dpr;
        ctx.lineCap = "round";
        ctx.stroke();

        // Ticks (like a sci-fi dial).
        const tickN = 24;
        for (let i = 0; i <= tickN; i++) {
          const t = i / tickN;
          const a = a0 + span * t;
          const inner = r - (i % 6 === 0 ? 18 : 12) * s.dpr;
          const outer = r + (i % 6 === 0 ? 10 : 6) * s.dpr;
          const x1 = gaugeCx + Math.cos(a) * inner;
          const y1 = gaugeCy + Math.sin(a) * inner;
          const x2 = gaugeCx + Math.cos(a) * outer;
          const y2 = gaugeCy + Math.sin(a) * outer;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = i % 6 === 0 ? colors.hudTick : "rgba(255,255,255,0.12)";
          ctx.lineWidth = (i % 6 === 0 ? 2.2 : 1.4) * s.dpr;
          ctx.stroke();
        }

        // Charged arc with brand gradient.
        if (p > 0.002) {
          const gx = gaugeCx - r;
          const gy = gaugeCy - r;
          const grad = ctx.createLinearGradient(gx, gy, gx + 2 * r, gy + 2 * r);
          grad.addColorStop(0.0, "rgba(99, 102, 241, 0.95)"); // indigo
          grad.addColorStop(0.55, "rgba(167, 139, 250, 0.95)"); // violet
          grad.addColorStop(1.0, "rgba(45, 212, 191, 0.85)"); // teal

          ctx.beginPath();
          ctx.arc(gaugeCx, gaugeCy, r, a0, endA);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 8 * s.dpr;
          ctx.lineCap = "round";
          ctx.stroke();

          // “Spark” at the tip (makes it feel alive, not generic).
          const sx = gaugeCx + Math.cos(endA) * r;
          const sy = gaugeCy + Math.sin(endA) * r;
          const pulse = 0.55 + 0.45 * Math.sin(now / 140);
          ctx.beginPath();
          ctx.arc(sx, sy, (6 + 3 * pulse) * s.dpr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(167, 139, 250, ${0.35 + 0.35 * pulse})`;
          ctx.fill();
        }

        // Readout text centered under gauge.
        // In the "finalizing" phase we want a slow, believable tick-up (85→100),
        // not a jittery rounded value.
        const pct = (() => {
          if (phase === "finalizing" && typeof eta === "number" && eta >= 0) {
            // eta counts down from ~15 → 0
            const v = Math.floor(100 - eta);
            return clamp(v, 85, 100);
          }
          return Math.round(p * 100);
        })();
        const label = phase ? `Processing (${phase})` : "Processing";
        const etaText =
          typeof eta === "number" && eta >= 0
            ? `ETA ~${Math.max(0, Math.round(eta))}s`
            : "Calibrating ETA…";

        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // On small mobile screens, keep the HUD compact: only show % + a short ETA.
        if (small) {
          ctx.fillStyle = colors.ui;
          ctx.font = `800 ${14 * s.dpr}px ui-sans-serif, system-ui`;
          ctx.fillText(`${pct}%`, gaugeCx, gaugeCy + 18 * s.dpr);

          ctx.fillStyle = colors.hudText;
          ctx.font = `${10 * s.dpr}px ui-sans-serif, system-ui`;
          ctx.fillText(typeof etaText === "string" ? etaText.replace("Calibrating ", "") : etaText, gaugeCx, gaugeCy + 38 * s.dpr);
        } else {
          ctx.fillStyle = colors.hudText;
          ctx.font = `600 ${10 * s.dpr}px ui-sans-serif, system-ui`;
          ctx.fillText(label, gaugeCx, gaugeCy + 14 * s.dpr);

          ctx.fillStyle = colors.ui;
          ctx.font = `800 ${15 * s.dpr}px ui-sans-serif, system-ui`;
          ctx.fillText(`${pct}%`, gaugeCx, gaugeCy + 28 * s.dpr);

          ctx.fillStyle = colors.hudText;
          ctx.font = `${10 * s.dpr}px ui-sans-serif, system-ui`;
          ctx.fillText(etaText, gaugeCx, gaugeCy + 48 * s.dpr);
        }
      }

      // Click pulse feedback: a quick ring around the hourglass center.
      if (s.clickPulseUntil > now) {
        const p = 1 - clamp((s.clickPulseUntil - now) / 220, 0, 1);
        const r = (Math.min(s.hgW, s.hgH) * 0.65 + p * 34 * s.dpr);
        const a = 0.45 * (1 - p);
        ctx.beginPath();
        ctx.arc(s.cx, s.cy, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.strokeStyle = `rgba(167, 139, 250, ${a})`;
        ctx.lineWidth = 2.2 * s.dpr;
        ctx.stroke();
      }
    };

    const loop = (tNow: number) => {
      update(tNow);
      draw();
      const s = stateRef.current;
      if (!s) return;
      s.rafId = requestAnimationFrame(loop);
    };

    init();
    const s = stateRef.current!;
    s.tPrev = performance.now();
    s.rafId = requestAnimationFrame(loop);

    return () => {
      const st = stateRef.current;
      if (st?.rafId != null) cancelAnimationFrame(st.rafId);
      canvas.removeEventListener("click", onClickOrTouch as any);
      canvas.removeEventListener("touchstart", onClickOrTouch as any);
      window.removeEventListener("resize", onResize);
      stateRef.current = null;
    };
  }, [status, colors]);

  if (status !== "polling") return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        background: colors.bg,
        borderRadius: 16,
        touchAction: "none",
      }}
      aria-hidden="true"
    />
  );
}

