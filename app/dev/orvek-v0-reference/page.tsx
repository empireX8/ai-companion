import type { Metadata } from "next";

import { Workbench } from "@/components/orvek-v0/workbench";

export const metadata: Metadata = {
  title: "Orvek v0 Reference (dev)",
  robots: { index: false, follow: false },
};

export default function OrvekV0ReferencePage() {
  return (
    <div data-testid="orvek-v0-reference-route">
      <Workbench />
    </div>
  );
}
