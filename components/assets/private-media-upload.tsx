"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function PrivateMediaUpload() {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setMessage("");
    try { const response = await fetch("/api/assets/upload", { method: "POST", body: new FormData(form) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Upload failed."); form.reset(); setMessage("Uploaded to private media storage."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="quiet-panel"><strong>Upload private audio or video</strong><p className="muted">MP3, WAV, M4A, MP4, MOV or WebM; maximum 50 MB.</p><input type="file" name="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,video/mp4,video/quicktime,video/webm" required /><button className="button button--secondary" disabled={busy} type="submit">{busy ? "Uploading…" : "Upload"}</button><p role="status">{message}</p></form>;
}
