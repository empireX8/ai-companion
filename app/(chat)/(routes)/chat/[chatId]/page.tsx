import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { ChatClient } from "./components/client";

interface ChatIdPageProps {
  params: Promise<{ chatId: string }>;
}

const ChatIdPage = async ({ params }: ChatIdPageProps) => {
  const { chatId } = await params;
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    return redirect("/sign-in");
  }

  const companion = await prismadb.companion.findUnique({
    where: { id: chatId },
    include: {
      messages: {
        where: { userId },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  if (!companion) {
    return redirect("/");
  }

  return <ChatClient companion={companion} />;
};

export default ChatIdPage;
