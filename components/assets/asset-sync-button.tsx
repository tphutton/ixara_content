"use client";

import { useFormStatus } from "react-dom";

export function AssetSyncButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button button--primary" disabled={pending} type="submit">
      {pending ? "Syncing..." : "Sync latest WordPress media"}
    </button>
  );
}
