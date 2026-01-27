import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.category.createMany({
    data: [
      { name: "Famous People" },
      { name: "Movies & TV" },
      { name: "Musicians" },
      { name: "Games" },
      { name: "Animals" },
      { name: "Philosophy" },
      { name: "Scientists" },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
