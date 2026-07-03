import type {
  V0TodayInspectorTab,
  V0TodayIntentMetadata,
  V0TodayOverlayId,
  V0TodayPageId,
} from "../orvek-adapters/types";

/**
 * Production Today distinguishes between:
 * - integrated workbench routes that preserve the shared Orvek shell/Inspector context
 * - valid re-entry routes that are visible v0 destinations, even when they do not share the shell
 */
export const INTEGRATED_ORVEK_WORKBENCH_ROUTE_PREFIXES = [
  "/your-map",
  "/actions",
  "/timeline",
  "/explore",
  "/what-changed",
] as const;

export const TODAY_REENTRY_ROUTE_PREFIXES = [
  ...INTEGRATED_ORVEK_WORKBENCH_ROUTE_PREFIXES,
  "/watch-for",
  "/journal-chat",
] as const;

function normalizeHrefPath(href: string | null | undefined): string | null {
  if (!href || href === "#") {
    return null;
  }

  return (href.split("?")[0] ?? href).replace(/\/$/, "") || "/";
}

function matchesRoutePrefixes(
  href: string | null | undefined,
  prefixes: readonly string[]
): boolean {
  const path = normalizeHrefPath(href);
  if (!path) {
    return false;
  }

  if (path === "/") {
    return true;
  }

  return prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function isIntegratedOrvekWorkbenchHref(href: string | null | undefined): boolean {
  return matchesRoutePrefixes(href, INTEGRATED_ORVEK_WORKBENCH_ROUTE_PREFIXES);
}

export function isTodayReentryHref(href: string | null | undefined): boolean {
  return matchesRoutePrefixes(href, TODAY_REENTRY_ROUTE_PREFIXES);
}

export type TodayNowRowTarget =
  | {
      kind: "route";
      href: string;
    }
  | {
      kind: "inspect";
    }
  | null;

export function resolveTodayNowRowTarget(input: {
  href: string | null | undefined;
  hasSelection: boolean;
  hasRegisteredSelection: boolean;
}): TodayNowRowTarget {
  if (isTodayReentryHref(input.href)) {
    return { kind: "route", href: input.href! };
  }

  if (input.hasSelection && input.hasRegisteredSelection) {
    return { kind: "inspect" };
  }

  return null;
}

export type TodayWorkbenchCommand =
  | {
      kind: "openReport";
      reportId: string;
    }
  | {
      kind: "setPage";
      pageId: V0TodayPageId;
    }
  | {
      kind: "setOverlay";
      overlayId: V0TodayOverlayId;
    }
  | {
      kind: "select";
      objectId: string;
      inspectorTab: V0TodayInspectorTab;
    };

export type TodayWorkbenchIntentInput = V0TodayIntentMetadata & {
  href?: string | null;
};

export function resolveTodayWorkbenchCommands(
  input: TodayWorkbenchIntentInput,
): TodayWorkbenchCommand[] {
  const commands: TodayWorkbenchCommand[] = [];

  if (input.pageId) {
    commands.push({ kind: "setPage", pageId: input.pageId });
  }

  if (input.overlayId) {
    commands.push({ kind: "setOverlay", overlayId: input.overlayId });
  }

  if (input.reportId) {
    commands.push({ kind: "openReport", reportId: input.reportId });
  }

  const selectionId = input.movementId ?? input.inspectSelectId ?? input.selectionId;
  if (selectionId) {
    commands.push({
      kind: "select",
      objectId: selectionId,
      inspectorTab: input.movementId ? "movement" : input.inspectorTab ?? "evidence",
    });
  }

  return commands;
}

export function runTodayWorkbenchCommands(
  commands: TodayWorkbenchCommand[],
  handlers: {
    select: (id: string, tab?: V0TodayInspectorTab) => void;
    openReport: (reportId: string) => void;
    setPage: (pageId: V0TodayPageId) => void;
    setOverlay: (overlayId: V0TodayOverlayId) => void;
  },
): void {
  for (const command of commands) {
    switch (command.kind) {
      case "setPage":
        handlers.setPage(command.pageId);
        break;
      case "setOverlay":
        handlers.setOverlay(command.overlayId);
        break;
      case "openReport":
        handlers.openReport(command.reportId);
        break;
      case "select":
        handlers.select(command.objectId, command.inspectorTab);
        break;
    }
  }
}
