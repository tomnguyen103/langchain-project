import { redirect } from "next/navigation";

export default function ReviewPage() {
  redirect("/governance?tab=queue");
}
