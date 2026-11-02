"use client";
import { useState } from "react";

export function AudioReview({ assetId, initialReview }: { assetId: string; initialReview: string }) {
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(initialReview);
  const [error, setError] = useState("");
  async function runReview() {
    setBusy(true); setError(""); setReview("");
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}/review`, { method: "POST" });
      const isJson = response.headers.get("content-type")?.includes("application/json");
      if (!isJson) throw new Error(response.redirected ? "Your session may have expired. Please sign in and try again." : "The server returned an unexpected response. Please try again.");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Review failed.");
      setReview(result.review);
    } catch (e) { setError(e instanceof Error ? e.message : "Review failed."); }
    finally { setBusy(false); }
  }
  return <section className="quiet-panel"><strong>Review narration</strong><p className="muted">Send this MP3 or WAV (up to 10 MB) to OpenAI for feedback on delivery and pacing. Each review uses API credits.</p><button type="button" className="button button--secondary" onClick={runReview} disabled={busy}>{busy ? "Reviewing…" : "Review audio"}</button>{error && <p role="alert">{error}</p>}{review && <div className="preserve-lines" aria-live="polite">{review}</div>}</section>;
}
