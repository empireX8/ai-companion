import { redirect } from "next/navigation";

/**
 * /projections — forecast feature removed from V1.
 * Redirect all direct URL hits to /patterns so existing bookmarks
 * land somewhere meaningful.
 */
export default function ProjectionsPage() {
  redirect("/patterns");
}
