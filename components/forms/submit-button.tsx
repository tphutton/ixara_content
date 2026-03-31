"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
};

export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`button ${variant === "primary" ? "button--primary" : "button--secondary"}`}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel ?? "Saving..." : label}
    </button>
  );
}
