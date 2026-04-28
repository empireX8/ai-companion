import { redirect } from "next/navigation";
import { buildChatRouteHref } from "@/lib/chat-surface-routing";

export default function JournalChatPage() {
  redirect(buildChatRouteHref("journal_chat"));
}
