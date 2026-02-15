"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Settings,
  Plus,
  ChartNoAxesColumn,
  Split,
  BookOpenText,
} from "lucide-react";

export const Sidebar = () => {
  const router = useRouter();
  const pathname = usePathname();

  const routes = [
    { icon: LayoutDashboard, label: "Home", href: "/" },
    { icon: Plus, label: "Create", href: "/chat" },
    { icon: Split, label: "Contradictions", href: "/contradictions" },
    { icon: BookOpenText, label: "References", href: "/references" },
    { icon: ChartNoAxesColumn, label: "Audit", href: "/audit" },
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
