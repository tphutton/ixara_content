import { getCurrentUserAccess } from "@/lib/auth/user-access";
import { UserButton } from "@clerk/nextjs";

type WorkspaceHeaderProps = {
  title: string;
  description: string;
};

export async function WorkspaceHeader({
  title,
  description,
}: WorkspaceHeaderProps) {
  const access = await getCurrentUserAccess();
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <header className="workspace-header">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="header-actions">
        <span className="inline-chip">{todayLabel}</span>
        {access ? (
          <span className="user-chip">
            {access.role} • {access.approvalStatus}
          </span>
        ) : null}
        <UserButton />
      </div>
    </header>
  );
}
