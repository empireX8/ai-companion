import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const REFERENCE_SELECT = {
  id: true,
  type: true,
  confidence: true,
  statement: true,
  status: true,
  updatedAt: true,
} as const;

async function getLinkedRefs(contradictionId: string, userId: string) {
  const links = await prismadb.contradictionReferenceLink.findMany({
    where: {
      contradictionId,
      contradiction: { userId },
    },
    include: {
      reference: { select: REFERENCE_SELECT },
    },
    orderBy: { reference: { updatedAt: "desc" } },
  });
  return links.map((link) => ({
    ...link.reference,
    link: {
      asserted: link.asserted,
      assertedAt: link.assertedAt?.toISOString() ?? null,
      createdAt: link.createdAt.toISOString(),
    },
  }));
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await Promise.resolve(params);
    if (!id) return new NextResponse("Missing id", { status: 400 });

    const refs = await getLinkedRefs(id, userId);
    return NextResponse.json(refs);
  } catch (error) {
    console.log("[CONTRADICTION_REFERENCES_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await Promise.resolve(params);
    if (!id) return new NextResponse("Missing id", { status: 400 });

    const contradiction = await prismadb.contradictionNode.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!contradiction) return new NextResponse("Not found", { status: 404 });

    const body = await req.json();
    const referenceId = typeof body?.referenceId === "string" ? body.referenceId : null;
    if (!referenceId) return new NextResponse("referenceId required", { status: 400 });

    const reference = await prismadb.referenceItem.findFirst({
      where: { id: referenceId, userId },
      select: { id: true },
    });
    if (!reference) return new NextResponse("Reference not found", { status: 404 });

    await prismadb.contradictionReferenceLink.upsert({
      where: {
        contradictionId_referenceId: { contradictionId: id, referenceId },
      },
      create: { contradictionId: id, referenceId },
      update: {},
    });

    const refs = await getLinkedRefs(id, userId);
    return NextResponse.json(refs);
  } catch (error) {
    console.log("[CONTRADICTION_REFERENCES_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await Promise.resolve(params);
    if (!id) return new NextResponse("Missing id", { status: 400 });

    const contradiction = await prismadb.contradictionNode.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!contradiction) return new NextResponse("Not found", { status: 404 });

    const body = await req.json();
    const referenceId = typeof body?.referenceId === "string" ? body.referenceId : null;
    if (!referenceId) return new NextResponse("referenceId required", { status: 400 });

    const asserted = typeof body?.asserted === "boolean" ? body.asserted : null;
    if (asserted === null) return new NextResponse("asserted (boolean) required", { status: 400 });

    await prismadb.contradictionReferenceLink.update({
      where: {
        contradictionId_referenceId: { contradictionId: id, referenceId },
      },
      data: {
        asserted,
        assertedAt: asserted ? new Date() : null,
      },
    });

    const refs = await getLinkedRefs(id, userId);
    return NextResponse.json(refs);
  } catch (error) {
    console.log("[CONTRADICTION_REFERENCES_PATCH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await Promise.resolve(params);
    if (!id) return new NextResponse("Missing id", { status: 400 });

    const contradiction = await prismadb.contradictionNode.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!contradiction) return new NextResponse("Not found", { status: 404 });

    const body = await req.json();
    const referenceId = typeof body?.referenceId === "string" ? body.referenceId : null;
    if (!referenceId) return new NextResponse("referenceId required", { status: 400 });

    await prismadb.contradictionReferenceLink.deleteMany({
      where: { contradictionId: id, referenceId, contradiction: { userId } },
    });

    const refs = await getLinkedRefs(id, userId);
    return NextResponse.json(refs);
  } catch (error) {
    console.log("[CONTRADICTION_REFERENCES_DELETE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
