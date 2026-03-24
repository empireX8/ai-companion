import { redirect } from "next/navigation";

/**
 * /projections/:id — forecast detail removed from V1.
 * Redirect to /patterns. Existing projection data is preserved in the DB.
 */
export default function ProjectionDetailPage() {
  redirect("/patterns");
}
