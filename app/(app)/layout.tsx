import { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NavigationSpinner } from "@/components/layout/navigation-spinner";
import { DeleteConfirmationGuard } from "@/components/layout/delete-confirmation-guard";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireApprovedUserAccess();

  return (
    <div className="app-shell">
      <NavigationSpinner />
      <DeleteConfirmationGuard />
      <AppSidebar />
      <main className="main-panel">{children}</main>
    </div>
  );
}
