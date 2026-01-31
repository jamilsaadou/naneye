import { redirect } from "next/navigation";

export default async function TaxpayerCategoriesPage() {
  redirect("/admin/settings");
}
