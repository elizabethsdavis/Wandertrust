// Share sheet for a trip's packing list: copy the Markdown, hand it to the
// phone's share sheet, or download it as a .md file. Pure presentation — the
// text is built by lib/exportList.js and passed in.
import { useState } from "react";
import { X, ClipboardCopy, Share2, Download, Check } from "lucide-react";
import { C, F } from "../lib/theme";

function download(text, filename) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ShareSheet({ text, filename, title, onClose }) {
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    setErr("");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setErr("Couldn't copy — select the text below and copy it by hand.");
    }
  };
  const share = async () => {
    setErr("");
    try {
      await navigator.share({ title, text });
    } catch (e) {
      if (e?.name !== "AbortError") setErr("Sharing isn't available here — use Copy or Download instead.");
    }
  };

  const row = { width: "100%", minHeight: 52, borderRadius: 14, cursor: "pointer", border: `1px solid ${C.borderLight}`,
    background: C.warmWhite, marginBottom: 10, display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
    fontFamily: F.body, fontSize: 14.5, fontWeight: 500, color: C.charcoal };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(45,41,38,.35)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: C.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: "8px 22px 30px", boxShadow: `0 -8px 40px ${C.shadowMed}`, animation: "fadeIn .2s ease", maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.borderMedium, margin: "8px auto 18px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h3 style={{ fontFamily: F.display, fontSize: 26, color: C.charcoal, fontWeight: 400, margin: 0 }}>Share list</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={C.softGray} />
          </button>
        </div>
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.warmGray, margin: "0 0 16px", lineHeight: 1.5 }}>
          A Markdown checklist of this trip as it is right now — paste it straight into Claude, Notes, or a message.
        </p>

        <button onClick={copy} style={row}>
          {copied ? <Check size={18} color={C.sage} /> : <ClipboardCopy size={18} color={C.copper} />}
          {copied ? "Copied!" : "Copy as text"}
        </button>
        {canShare && (
          <button onClick={share} style={row}>
            <Share2 size={18} color={C.copper} /> Share…
          </button>
        )}
        <button onClick={() => download(text, filename)} style={row}>
          <Download size={18} color={C.copper} /> Download {filename}
        </button>
        {err && <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.danger, padding: "0 4px 10px" }}>{err}</div>}

        <details style={{ marginTop: 6 }}>
          <summary style={{ fontFamily: F.body, fontSize: 12.5, color: C.softGray, cursor: "pointer" }}>Preview</summary>
          <textarea readOnly value={text} aria-label="Markdown preview"
            style={{ width: "100%", height: 220, marginTop: 8, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, lineHeight: 1.45,
              color: C.charcoal, background: C.warmWhite, border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: 12, resize: "vertical" }} />
        </details>
      </div>
    </div>
  );
}
