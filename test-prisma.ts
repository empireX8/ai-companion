import prismadb from "./lib/prismadb";

async function test() {
  const models = Object.keys(prismadb);
  console.log(models);
}

test();
