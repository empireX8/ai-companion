import { redirect } from "next/navigation";
import { buildChatRouteHref } from "@/lib/chat-surface-routing";

export default function ExplorePage() {
  redirect(buildChatRouteHref("explore_chat"));
}
