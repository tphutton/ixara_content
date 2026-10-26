"use client";

import { useState } from "react";

export function CopyTextButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return <span className="brief-copy-control"><button type="button" className="button button--secondary" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setState("copied"); }
    catch { setState("failed"); }
  }}>{label}</button><span role="status">{state === "copied" ? "Copied" : state === "failed" ? "Select and copy the text below." : ""}</span></span>;
}
