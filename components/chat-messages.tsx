"use client";

import { useEffect, useState } from "react";
import { Companion } from "@prisma/client";
import type { UIMessage } from "ai";

import { ChatMessage } from "@/components/chat-message";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
  companion: Companion;
}

type TextPart = { type: "text"; text: string };
type MessagePart = UIMessage["parts"][number];
type MessageTextPart = Extract<MessagePart, TextPart>;

function isTextPart(part: MessagePart): part is MessageTextPart {
  return part.type === "text" && typeof part.text === "string";
}

export const ChatMessages = ({
  messages = [],
  isLoading,
  companion,
}: ChatMessagesProps) => {
  const getMessageContent = (message: UIMessage) => {
    return message.parts
      .filter(isTextPart)
      .map((part) => part.text)
      .join("");
  };

  const [fakeLoading, setFakeLoading] = useState(messages.length === 0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFakeLoading(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto pr-4">
      <div className="space-y-4">
        {/* Initial system message */}
        <ChatMessage
          isLoading={fakeLoading}
          src={companion.src}
          name={companion.name}
          role="system"
          content={`Hello, I am ${companion.name}, ${companion.description}`}
        />

        {/* Existing messages */}
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            role={message.role}
            content={getMessageContent(message)}
            src={message.role === "user" ? undefined : companion.src}
            name={message.role === "user" ? undefined : companion.name}
          />
        ))}

        {/* Loading bubble */}
        {isLoading && (
          <ChatMessage
            role="system"
            src={companion.src}
            name={companion.name}
            isLoading
          />
        )}
      </div>
    </div>
  );
};
