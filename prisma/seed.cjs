// 🚨 This file intentionally uses CommonJS (require) not imports.
// Prisma seeds run in CJS mode — this avoids ts-node + ESM failures.

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});
const prismadb = require("../lib/prismadb").default;
const { fallbackCategories } = require("../lib/fallback-categories");

async function main() {
  console.log("🌱 Seeding categories into database...\n");

  for (const category of fallbackCategories) {
    await prismadb.category.upsert({
      where: { id: category.id },
      update: { name: category.name },
      create: { id: category.id, name: category.name }
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
