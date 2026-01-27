"use client";

import { ChangeEvent, FormEvent } from "react";
import { SendHorizonal } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ChatFormProps {
  input: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onInputChange: (e: ChangeEvent<any>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export const ChatForm = ({
  input,
  onInputChange,
  onSubmit,
  isLoading,
}: ChatFormProps) => {
  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-primary/10 py-4 flex items-center gap-x-2"
    >
      <Input
        disabled={isLoading}
        value={input}
        onChange={onInputChange}
        placeholder="Type a message"
        className="rounded-lg bg-primary/10"
      />

      <Button
        disabled={isLoading || !input.trim()}
        type="submit"
        variant="outline"
      >
        <SendHorizonal className="w-6 h-6" />
      </Button>
    </form>
  );
};
