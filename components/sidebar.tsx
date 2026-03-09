"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  Database,
  LayoutDashboard,
  Settings,
  Plus,
  ChartNoAxesColumn,
  Split,
  BookOpenText,
  Upload,
} from "lucide-react";

export const Sidebar = () => {
  const router = useRouter();
  const pathname = usePathname();

  const routes = [
    { icon: LayoutDashboard, label: "Home", href: "/" },
    { icon: Plus, label: "Create", href: "/chat" },
    { icon: Split, label: "Tensions", href: "/contradictions" },
    { icon: BookOpenText, label: "Memories", href: "/references" },
    { icon: Upload, label: "Import", href: "/import" },
    { icon: Database, label: "Evidence", href: "/evidence" },
    { icon: ChartNoAxesColumn, label: "Review", href: "/audit" },
    { icon: Activity, label: "Metrics", href: "/metrics" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="h-full w-20 bg-secondary flex flex-col items-center py-4 text-primary">
      {routes.map((route) => {
        const active = pathname === route.href;
        const Icon = route.icon;
        return (
          <button
            key={route.href}
            onClick={() => router.push(route.href)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-lg p-3 w-full transition",
              "hover:text-primary hover:bg-primary/10",
              active && "bg-primary/10 text-primary"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{route.label}</span>
          </button>
        );
      })}
    </div>
  );
};
