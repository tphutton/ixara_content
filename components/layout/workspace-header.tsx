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

  return (
    <header className="workspace-header">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="header-actions">
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
