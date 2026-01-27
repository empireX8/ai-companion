"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { Companion, Message as PrismaMessage } from "@prisma/client";

import { ChatForm } from "@/components/chat-form";
import { ChatHeader } from "@/components/chat-header";
import { ChatMessages } from "@/components/chat-messages";

interface ChatClientProps {
  companion: Companion & {
    messages: PrismaMessage[];
    _count: { messages: number };
  };
}

export const ChatClient = ({ companion }: ChatClientProps) => {
  const initialMessages: UIMessage[] = companion.messages.map((m) => {
    const text = m.content ?? "";
    return {
      id: m.id,
      role: m.role as UIMessage["role"],
      content: text,
      parts: [{ type: "text", text }],
    };
  });

  const { messages, status, sendMessage } = useChat<UIMessage>({
    id: companion.id,
    messages: initialMessages,
  });

  const [input, setInput] = useState("");

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    await sendMessage({
      role: "user",
      parts: [{ type: "text", text }],
    });
    setInput("");
  };

  const isLoading = status !== "ready";

  return (
    <div className="flex flex-col h-full p-4 space-y-2">
      <ChatHeader companion={companion} />

      <ChatMessages
        companion={companion}
        isLoading={isLoading}
        messages={messages}
      />

      <ChatForm
        isLoading={isLoading}
        input={input}
        onInputChange={onInputChange}
        onSubmit={onSubmit}
      />
    </div>
  );
};
