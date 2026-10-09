import { redirect } from "next/navigation"

/** Problem statements now belong to each event. */
export default function ChallengePage() {
  redirect("/dashboard/events")
}
