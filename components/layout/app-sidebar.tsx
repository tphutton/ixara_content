"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  Image as ImageIcon,
  Megaphone,
  LayoutDashboard,
  MessageSquareText,
  Newspaper,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const navGroups = [
  {
    label: "Command",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/planner", label: "Planner", icon: ClipboardList },
      { href: "/chat", label: "Quill Chat", icon: MessageSquareText },
    ],
  },
  {
    label: "Creation",
    items: [
      { href: "/content", label: "Content", icon: Sparkles },
      { href: "/blogs", label: "Blogs", icon: Newspaper },
      { href: "/assets", label: "Assets", icon: ImageIcon },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/automations", label: "Automations", icon: Bot },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/social-accounts", label: "Social", icon: ShieldCheck },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const IXARA_LOGO_URL = "https://media.ixara.tech/wp-content/uploads/2026/07/ChatGPT-Image-Jul-27-2026-08_54_51-PM.png";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <Image
            alt="Ixara logo"
            height={74}
            priority
            src={IXARA_LOGO_URL}
            width={220}
          />
        </div>

        <h1>Content Command</h1>
        <p>AI-operated editorial workspace for planning, publishing, and performance intelligence.</p>
      </div>

      <nav aria-label="Workspace navigation" className="nav-groups">
        {navGroups.map((group) => (
          <section className="nav-group" key={group.label}>
            <p className="nav-group__label">{group.label}</p>
            <ul className="nav-list">
              {group.items.map((item) => {
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
          </section>
        ))}
      </nav>
    </aside>
  );
}
