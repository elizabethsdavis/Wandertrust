// Confetti + toast celebrations. `useCelebration()` returns { celebrate, CelebrationLayer }.
import { useState, useEffect, useRef, useCallback } from "react";
import { C, F } from "../lib/theme";
import { haptic } from "../lib/utils";

// ── Confetti System ──
const CONFETTI_COLORS = ["#C17F59", "#D4A574", "#8BA888", "#A8C4A5", "#D4A04A", "#E8B84A", "#9B8EC4", "#B8A8D8", "#4EADC5", "#F2C6DE", "#FFD700"];
function ConfettiBurst({ intensity = "medium", onDone }) {
  const canvasRef = useRef(null);
  const count = intensity === "big" ? 120 : intensity === "medium" ? 60 : 30;
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const W = cvs.width = window.innerWidth, H = cvs.height = window.innerHeight;
    const pieces = Array.from({ length: count }, () => ({
      x: W * (.3 + Math.random() * .4), y: H * (.3 + Math.random() * .2),
      vx: (Math.random() - .5) * (intensity === "big" ? 18 : 10),
      vy: -(Math.random() * (intensity === "big" ? 18 : 12) + 4),
      w: Math.random() * 10 + 4, h: Math.random() * 6 + 2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rot: Math.random() * 360, rotV: (Math.random() - .5) * 12,
      gravity: .25 + Math.random() * .15, drag: .98 + Math.random() * .015,
      opacity: 1, shape: Math.random() > .5 ? "rect" : "circle",
    }));
    let frame = 0, raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      pieces.forEach(p => {
        p.vy += p.gravity; p.vx *= p.drag; p.vy *= p.drag;
        p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
        if (frame > 40) p.opacity = Math.max(0, p.opacity - .018);
        if (p.opacity <= 0 || p.y > H + 20) return;
        alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        if (p.shape === "rect") ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        else { ctx.beginPath(); ctx.arc(0, 0, p.w / 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      });
      frame++;
      if (alive > 0 && frame < 200) raf = requestAnimationFrame(draw);
      else onDone?.();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }} />;
}

// ── Celebration Toast ──
const CELEBRATE_MSGS = {
  section: ["Section done!", "Crushed it!", "That's a wrap!", "Nailed it!", "On a roll!"],
  category: ["Category complete!", "Whole category — boom!", "You're unstoppable!", "Category conquered!"],
  allPacked: ["ALL PACKED!", "You legend!", "Trip-ready!", "Everything's in!"],
  allRefilled: ["All refilled!", "Restocked & ready!", "Refill champion!"],
  allCharged: ["All charged up!", "Fully juiced!", "Powered & ready!"],
  otdDone: ["Ready to go!", "Out the door!", "Nothing forgotten!"],
  outfitDone: ["Outfit complete!", "Styled & sorted!", "Looking good!"],
};
function CelebrationToast({ msg, emoji }) {
  return (
    <div style={{ position: "fixed", top: "15%", left: "50%", transform: "translateX(-50%)", zIndex: 9998,
      background: "rgba(255,255,255,.95)", backdropFilter: "blur(12px)", borderRadius: 20,
      padding: "16px 28px", boxShadow: "0 8px 40px rgba(45,41,38,.18)", textAlign: "center",
      animation: "celebToastIn .4s cubic-bezier(.34,1.56,.64,1)" }}>
      <div style={{ fontSize: 36, marginBottom: 6 }}>{emoji}</div>
      <div style={{ fontFamily: F.body, fontSize: 16, fontWeight: 600, color: C.charcoal }}>{msg}</div>
    </div>
  );
}

export function useCelebration() {
  const [show, setShow] = useState(null); // { msg, emoji, intensity }
  const timerRef = useRef(null);
  const celebrate = useCallback((type, intensity = "medium") => {
    const msgs = CELEBRATE_MSGS[type] || CELEBRATE_MSGS.section;
    const emojis = { section: "🎉", category: "🏆", allPacked: "🎊", allRefilled: "✅", allCharged: "🔋", otdDone: "🚀", outfitDone: "👗" };
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    haptic("celebration");
    setShow({ msg, emoji: emojis[type] || "🎉", intensity });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(null), intensity === "big" ? 3500 : 2200);
  }, []);
  const CelebrationLayer = useCallback(() => {
    if (!show) return null;
    return (
      <>
        <ConfettiBurst intensity={show.intensity} onDone={() => { if (show.intensity !== "big") setShow(null); }} />
        <CelebrationToast msg={show.msg} emoji={show.emoji} />
      </>
    );
  }, [show]);
  return { celebrate, CelebrationLayer };
}
