"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  name?: string;
  value?: string;
};

export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
  name,
  value,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`button ${variant === "primary" ? "button--primary" : "button--secondary"}`}
      disabled={pending}
      name={name}
      type="submit"
      value={value}
    >
      {pending ? pendingLabel ?? "Saving..." : label}
    </button>
  );
}
