"use client";

import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/sidebar";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"; // 👈 import this

export const MobileSidebar = () => {
  return (
    <Sheet>
      {/* Hamburger button */}
      <SheetTrigger asChild>
        <button className="p-2 md:hidden">
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>

      {/* Slide-out drawer */}
      <SheetContent side="left" className="p-0 w-64">
        {/* 👇 This hidden title fixes the accessibility warning */}
        <VisuallyHidden>
          <h2>Mobile Sidebar</h2>
        </VisuallyHidden>

        <Sidebar />
      </SheetContent>
    </Sheet>
  );
};
