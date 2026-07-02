import { redirect } from "next/navigation";

export default function BrandsPage() {
  redirect("/workspace?tab=brands");
}
