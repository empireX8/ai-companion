import { ChatSurface } from "./ChatSurface";
import {
  resolveChatSurfacePresetFromSearchParam,
} from "@/lib/chat-surface-presets";
import { CHAT_SURFACE_SEARCH_PARAM } from "@/lib/chat-surface-routing";

type SearchParams = Record<string, string | string[] | undefined>;

type ChatPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const rawSurface = resolvedSearchParams[CHAT_SURFACE_SEARCH_PARAM];
  const surfaceValue = Array.isArray(rawSurface) ? rawSurface[0] : rawSurface;
  const preset = resolveChatSurfacePresetFromSearchParam(surfaceValue ?? null);

  return (
    <ChatSurface
      key={`chat-${preset.surfaceType}`}
      {...preset}
      switcherMode="chat-query"
    />
  );
}
