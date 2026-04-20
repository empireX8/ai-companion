import {
  resolveTimelineWindowSearchParam,
  type TimelineWindow,
} from "../../../../lib/timeline-aggregation";

import { TimelineSurface } from "./_components/TimelineSurface";

type TimelinePageProps = {
  searchParams?: Promise<{
    window?: string | string[];
  }>;
};

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
  const resolvedSearchParams = await searchParams;
  const initialWindow: TimelineWindow = resolveTimelineWindowSearchParam(
    resolvedSearchParams?.window
  );

  return <TimelineSurface key={initialWindow} initialWindow={initialWindow} />;
}
