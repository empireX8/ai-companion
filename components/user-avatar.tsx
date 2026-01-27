"use client";

import { useUser } from "@clerk/nextjs";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const UserAvatar = () => {
  const { user } = useUser();
  const displayName =
    user?.fullName ?? user?.username ?? user?.firstName ?? "";
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <Avatar className="h-12 w-12">
      {user?.imageUrl ? <AvatarImage src={user.imageUrl} /> : null}
      <AvatarFallback>
        <span className="text-sm font-semibold">
          {initials || "U"}
        </span>
      </AvatarFallback>
    </Avatar>
  );
};
