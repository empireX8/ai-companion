import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { currentUser } from "@clerk/nextjs/server";


export async function POST(req: Request) {
  try {
    const user = await currentUser();

    if (!user || !user.id || !user.firstName) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { name, description, instructions, seed, src, categoryId } = body;

console.log("\n🟦 COMPANION POST BODY:", body);


    if (!name || !description || !instructions || !seed || !src || !categoryId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const companion = await prismadb.companion.create({
      data: {
        userId: user.id,
        userName: user.firstName,
        name,
        description,
        instructions,
        seed,
        src,
        categoryId,
      },
    });

    return NextResponse.json(companion);
  } catch (error) {
    console.log("[COMPANION_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
