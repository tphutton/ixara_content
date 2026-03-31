"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  MessageSquareText,
  Newspaper,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquareText },
  { href: "/content", label: "Content", icon: Sparkles },
  { href: "/blogs", label: "Blogs", icon: Newspaper },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <h1>Content Ops AI</h1>
        <p>AI-operated editorial workspace for content planning, publishing, and oversight.</p>
      </div>

      <nav aria-label="Workspace navigation">
        <ul className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link className="nav-link" data-active={isActive} href={item.href}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
