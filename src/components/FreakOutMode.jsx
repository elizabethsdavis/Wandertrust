// Freak Out mode — the ADHD-friendly unfreeze flow.
import { useState, useEffect } from "react";
import { ChevronRight, Sparkles, ArrowLeft, Zap, Wind, Heart } from "lucide-react";
import { C, F } from "../lib/theme";
import { UNFREEZE_STEPS, AFFIRMATIONS } from "../data/content";
import { Btn } from "./ui";

// ── Freak Out Mode Component ──
export function FreakOutMode({ onExit, onStartPacking }) {
  const [step, setStep] = useState(-1); // -1 = landing
  const [affIdx, setAffIdx] = useState(() => Math.floor(Math.random() * AFFIRMATIONS.length));
  const [breathing, setBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState("in");
  const [breathCount, setBreathCount] = useState(0);

  useEffect(() => {
    if (!breathing) return;
    const phases = [
      { phase: "in", dur: 4000 },
      { phase: "hold", dur: 1000 },
      { phase: "out", dur: 6000 },
    ];
    let idx = 0;
    let timer;
    const cycle = () => {
      setBreathPhase(phases[idx].phase);
      timer = setTimeout(() => {
        idx = (idx + 1) % phases.length;
        if (idx === 0) setBreathCount(c => c + 1);
        cycle();
      }, phases[idx].dur);
    };
    cycle();
    return () => clearTimeout(timer);
  }, [breathing]);

  useEffect(() => {
    if (breathCount >= 3) setBreathing(false);
  }, [breathCount]);

  // Landing
  if (step === -1) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #F0EBF5 0%, ${C.cream} 100%)`,
        display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 28px" }}>
        <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, background: "none",
          border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
          <ArrowLeft size={18} /> Back
        </button>

        <div style={{ fontSize: 64, marginBottom: 16, marginTop: 40 }}>🧠</div>
        <h1 style={{ fontFamily: F.display, fontSize: 36, color: C.charcoal, fontWeight: 400,
          textAlign: "center", marginBottom: 8, lineHeight: 1.2 }}>
          Hey. It's okay.
        </h1>

        <div style={{ background: C.lavenderGlow, borderRadius: 16, padding: "16px 24px",
          maxWidth: 400, textAlign: "center", marginBottom: 32, border: `1px solid rgba(155,142,196,.15)` }}>
          <p style={{ fontFamily: F.body, fontSize: 15, color: C.charcoal, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
            "{AFFIRMATIONS[affIdx]}"
          </p>
        </div>

        <p style={{ fontFamily: F.body, fontSize: 15, color: C.warmGray, textAlign: "center",
          maxWidth: 380, lineHeight: 1.6, marginBottom: 32 }}>
          Your brain hit the freeze button. That's neurological, not a character flaw.
          Let's gently work through this together — no rush, no judgment.
        </p>

        <Btn v="lavender" sz="lg" onClick={() => setStep(0)} style={{ marginBottom: 16 }}>
          <Heart size={18} /> Start the unfreeze protocol
        </Btn>
        <button onClick={() => setAffIdx((affIdx + 1) % AFFIRMATIONS.length)}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: F.body,
            fontSize: 13, color: C.lavender, display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={14} /> Another affirmation
        </button>
      </div>
    );
  }

  const cur = UNFREEZE_STEPS[step];
  const isLast = step === UNFREEZE_STEPS.length - 1;

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #F0EBF5 0%, ${C.cream} 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 28px" }}>
      <button onClick={onExit} style={{ position: "absolute", top: 20, left: 20, background: "none",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        fontFamily: F.body, fontSize: 14, color: C.warmGray }}>
        <ArrowLeft size={18} /> Exit
      </button>

      {/* Progress */}
      <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
        {UNFREEZE_STEPS.map((_, i) => (
          <div key={i} style={{ width: i <= step ? 20 : 8, height: 8, borderRadius: 4,
            background: i <= step ? C.lavender : C.creamDark, transition: "all .3s" }} />
        ))}
      </div>

      <div style={{ fontSize: 56, marginBottom: 20 }}>{cur.icon}</div>
      <h2 style={{ fontFamily: F.display, fontSize: 32, color: C.charcoal, fontWeight: 400,
        textAlign: "center", marginBottom: 8 }}>
        {cur.title}
      </h2>
      <div style={{ fontFamily: F.body, fontSize: 12, color: C.lavender, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 20 }}>
        {cur.duration}
      </div>

      <p style={{ fontFamily: F.body, fontSize: 16, color: C.charcoal, textAlign: "center",
        maxWidth: 420, lineHeight: 1.7, marginBottom: 32 }}>
        {cur.body}
      </p>

      {/* Breathing exercise on step 0 */}
      {step === 0 && (
        <div style={{ marginBottom: 24 }}>
          {!breathing && breathCount < 3 ? (
            <Btn v="lavender" sz="sm" onClick={() => { setBreathing(true); setBreathCount(0); }}>
              <Wind size={15} /> Start guided breathing
            </Btn>
          ) : breathing ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 100, height: 100, borderRadius: "50%", margin: "0 auto 12px",
                background: C.lavenderGlow, display: "flex", alignItems: "center", justifyContent: "center",
                border: `3px solid ${C.lavender}`,
                transform: breathPhase === "in" ? "scale(1.3)" : breathPhase === "hold" ? "scale(1.3)" : "scale(1)",
                transition: breathPhase === "in" ? "transform 4s ease-in-out" : breathPhase === "out" ? "transform 6s ease-in-out" : "none" }}>
                <span style={{ fontFamily: F.body, fontSize: 14, fontWeight: 600, color: C.lavender, textTransform: "uppercase" }}>
                  {breathPhase === "in" ? "Breathe in..." : breathPhase === "hold" ? "Hold..." : "Breathe out..."}
                </span>
              </div>
              <span style={{ fontFamily: F.body, fontSize: 12, color: C.softGray }}>{breathCount + 1} of 3</span>
            </div>
          ) : (
            <div style={{ fontFamily: F.body, fontSize: 14, color: C.sage, textAlign: "center" }}>
              Nice. Three breaths done. You're already moving.
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        {step > 0 && <Btn v="secondary" sz="md" onClick={() => setStep(s => s - 1)}>Back</Btn>}
        {!isLast ? (
          <Btn v="lavender" sz="md" onClick={() => setStep(s => s + 1)}>
            I'm ready for the next step <ChevronRight size={16} />
          </Btn>
        ) : (
          <Btn v="sage" sz="lg" onClick={onStartPacking}>
            <Zap size={18} /> I'm ready to pack
          </Btn>
        )}
      </div>

      <div style={{ marginTop: 24, background: C.lavenderGlow, borderRadius: 12, padding: "12px 20px",
        maxWidth: 360, border: `1px solid rgba(155,142,196,.1)` }}>
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.lavender, textAlign: "center", margin: 0, fontStyle: "italic" }}>
          "{AFFIRMATIONS[(affIdx + step) % AFFIRMATIONS.length]}"
        </p>
      </div>
    </div>
  );
}
