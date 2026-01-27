"use client";

import { Sparkles } from "lucide-react";
import { Poppins } from "next/font/google";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { useProModal } from "@/hooks/use-pro-modal";

const font = Poppins({ weight: "600", subsets: ["latin"] });

export const Navbar = () => {
  const proModal = useProModal();

  return (
    <div className="fixed top-0 left-0 right-0 z-60 w-full flex items-center justify-between border-b border-primary/10 bg-secondary py-2 px-4 h-16">
      {/* Left: hamburger + logo */}
      <div className="flex items-center gap-2">
        <MobileSidebar />
        <Link href="/">
          <h1
            className={cn(
              "hidden md:block text-xl md:text-3xl font-bold text-primary",
              font.className
            )}
          >
            companion.ai
          </h1>
        </Link>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-x-3">
        <Button size="sm" variant="premium" onClick={proModal.onOpen}>
          Upgrade
          <Sparkles className="ml-2 h-4 w-4 fill-white text-white" />
        </Button>
        <ModeToggle />
        <UserButton />
      </div>
    </div>
  );
};
