import prismadb from "@/lib/prismadb";
import { Categories } from "@/components/categories";
import { Companions } from "@/components/companions";
import { SearchInput } from "@/components/search-input";
import { fallbackCategories } from "@/lib/fallback-categories";
import type { Companion, Category } from "@prisma/client";

type CompanionWithCount = Companion & { _count: { messages: number } };

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; name?: string }>;
}) {
  console.log("[ROOTPAGE] rendered");
  console.log("[ROOTPAGE] searchParams keys", Object.keys(await searchParams));
  const sp = await searchParams;
  let categories: Category[] = fallbackCategories;
  let data: CompanionWithCount[] = [];

  // Fetch categories
  try {
    categories = await prismadb.category.findMany();
  } catch {
    console.log("DB unavailable — using fallbackCategories");
  }

  // Fetch companions
  try {
    data = await prismadb.companion.findMany({
      where: {
        categoryId: sp.categoryId,
        name: sp.name ? { contains: sp.name, mode: "insensitive" }
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { messages: true } } },
    });
  } catch {
    console.log("Companion fetch failed → returning empty list");
  }

  return (
    <div className="h-full p-4 space-y-2">
      <SearchInput />
      <Categories data={categories} />
      <Companions data={data} />
    </div>
  );
}
