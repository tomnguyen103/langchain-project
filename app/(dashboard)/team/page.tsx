import { redirect } from "next/navigation";

export default function TeamPage() {
  redirect("/workspace?tab=team");
}
