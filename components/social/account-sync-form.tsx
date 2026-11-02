"use client";

import { useFormStatus } from "react-dom";

type AccountSyncFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  accountName: string;
  retry?: boolean;
  variant?: "primary" | "secondary";
};

function SyncFeedback({
  accountName,
  retry,
  variant = "primary",
}: Omit<AccountSyncFormProps, "action">) {
  const { pending } = useFormStatus();

  return (
    <div aria-busy={pending}>
      <button className={`button button--${variant}`} type="submit" disabled={pending}>
        {pending ? "Syncing…" : retry ? "Retry sync" : "Sync posts"}
      </button>
      <div role="status" aria-live="polite" className="table-subtext">
        {pending
          ? `Syncing ${accountName}: fetching posts and analytics from Meta. This can take a few minutes. Keep this page open until the result appears.`
          : ""}
      </div>
    </div>
  );
}

export function AccountSyncForm({ action, ...props }: AccountSyncFormProps) {
  return (
    <form action={action}>
      <SyncFeedback {...props} />
    </form>
  );
}
