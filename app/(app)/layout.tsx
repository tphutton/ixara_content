import { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireApprovedUserAccess();

  return (
    <div className="app-shell">
      <AppSidebar />
      <main className="main-panel">{children}</main>
    </div>
  );
}
