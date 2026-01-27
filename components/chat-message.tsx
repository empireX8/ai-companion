"use client";

import { Copy } from "lucide-react";
import { useTheme } from "next-themes";
import { BeatLoader } from "react-spinners";

import { BotAvatar } from "@/components/bot-avatar";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant" | "system" | "tool" | "data";
  content?: string | null;
  src?: string;
  name?: string;
  isLoading?: boolean;
}

export const ChatMessage = ({
  role,
  content,
  src,
  name,
  isLoading,
}: ChatMessageProps) => {
  const isUser = role === "user";
  const { toast } = useToast();
  const { theme } = useTheme();

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    toast({ description: "Message copied to clipboard" });
  };

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "group flex items-start gap-2 max-w-full",
          isUser && "flex-row-reverse"
        )}
      >
        {isUser ? (
          <UserAvatar />
        ) : (
          <BotAvatar src={src} name={name} />
        )}

        <div className="relative">
          <div
            className={cn(
              "rounded-lg bg-primary/10 px-3 py-2 text-sm max-w-sm whitespace-pre-wrap",
              isUser ? "text-right" : "text-left"
            )}
          >
            {isLoading ? (
              <BeatLoader
                size={6}
                color={theme === "dark" ? "#ffffff" : "#000000"}
              />
            ) : (
              content
            )}
          </div>

          {!isUser && !isLoading && content && (
            <Button
              variant="outline"
              size="icon"
              className="absolute -right-2 -top-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition"
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
