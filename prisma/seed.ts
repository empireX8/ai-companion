// Prisma seed script executed via ts-node in CommonJS mode (see package.json).
import prismadb from "../lib/prismadb";
import { fallbackCategories } from "../lib/fallback-categories";

async function main() {
  console.log("🌱 Seeding categories into database...\n");

  for (const category of fallbackCategories) {
    await prismadb.category.upsert({
      where: { id: category.id },
      update: { name: category.name },
      create: { id: category.id, name: category.name },
    });
  }

  console.log(`✔ Successfully seeded ${fallbackCategories.length} categories.`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:\n", err);
    process.exit(1);
  })
  .finally(async () => {
    await prismadb.$disconnect();
  });
