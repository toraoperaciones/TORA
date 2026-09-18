import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("Administración");

export default function AdminIndexPage() {
  redirect("/admin/tenants");
}
