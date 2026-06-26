"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DecisionsPage } from "@/components/orvek-v0/pages/decisions";
import { OrvekV0PageShell } from "@/components/orvek-v0/production/OrvekV0PageShell";
import { fetchActionsPageData, type ActionsPageData, type SurfacedActionView } from "@/lib/actions-api";
import { buildDecisionsProductionDataApi } from "@/lib/orvek-v0/production/decisions-api";

export function OrvekDecisionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ActionsPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      try {
        const next = await fetchActionsPageData();
        if (!cancelled) setData(next);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const list = useMemo<SurfacedActionView[]>(() => {
    if (!data) return [];
    const bucket = searchParams.get("bucket");
    return bucket === "build" ? data.buildForward : data.stabilizeNow;
  }, [data, searchParams]);

  const dataApi = useMemo(() => buildDecisionsProductionDataApi(list), [list]);

  void router;
  void isLoading;

  return (
    <OrvekV0PageShell data={dataApi}>
      <DecisionsPage />
    </OrvekV0PageShell>
  );
}
