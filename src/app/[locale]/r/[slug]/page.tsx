import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SharedReportView } from "@/components/SharedReportView";
import type { AnalysisResult } from "@/lib/experts/types";

interface Props {
  params: { locale: string; slug: string };
}

export default async function SharedReportPage({ params }: Props) {
  const record = await prisma.analysisResult.findUnique({
    where: { slug: params.slug },
  });

  if (!record) notFound();

  const result: AnalysisResult = JSON.parse(record.data);

  return <SharedReportView result={result} slug={params.slug} />;
}
