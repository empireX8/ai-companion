import prismadb from "@/lib/prismadb";
import { CompanionForm } from "./companion-form";

interface CompanionPageProps {
  params: { companionId: string };
}

export default async function CompanionPage({ params }: CompanionPageProps) {
  const companion = await prismadb.companion.findUnique({
    where: {
      id: params.companionId,
    },
  });

  const categories = await prismadb.category.findMany();

  return (
    <CompanionForm
      initialData={companion}
      categories={categories}
    />
  );
}
