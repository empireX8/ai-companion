// app/(root)/(routes)/companion/new/page.tsx

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prismadb from "@/lib/prismadb";
import { CompanionForm } from "../[companionId]/companion-form";
import { fallbackCategories } from "@/lib/fallback-categories";
// ure this import exists

export default async function NewCompanionPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // ✅ FIX: fallback logic
  let categories = fallbackCategories;

  try {
    const dbCategories = await prismadb.category.findMany();
    categories = dbCategories.length > 0 ? dbCategories : fallbackCategories;
  } catch (error) {
    console.warn("DB unavailable, using fallback categories", error);
    categories = fallbackCategories;
  }

  return (
    <div className="p-6">
      <CompanionForm initialData={null} categories={categories} />
    </div>
  );
}
