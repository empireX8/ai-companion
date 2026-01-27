"use client";

import Image from "next/image";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface BotAvatarProps {
  src?: string | null;
  name?: string;
}

const getInitials = (name?: string) => {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

export const BotAvatar = ({ src, name }: BotAvatarProps) => {
  const initials = getInitials(name);
  const safeSrc =
    typeof src === "string" && src.trim() !== "" ? src : undefined;

  return (
    <Avatar className="h-12 w-12">
      {safeSrc ? <AvatarImage src={safeSrc} /> : null}
      <AvatarFallback>
        {initials ? (
          <span className="text-sm font-semibold">{initials}</span>
        ) : (
          <Image
            src="/placeholder.svg"
            alt="Avatar"
            width={24}
            height={24}
          />
        )}
      </AvatarFallback>
    </Avatar>
  )
}
