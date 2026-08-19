import { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NavigationSpinner } from "@/components/layout/navigation-spinner";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireApprovedUserAccess();

  return (
    <div className="app-shell">
      <NavigationSpinner />
      <AppSidebar />
      <main className="main-panel">{children}</main>
    </div>
  );
}
