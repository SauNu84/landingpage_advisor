import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SharedReportView } from "@/components/SharedReportView";
import { BulkReportView } from "@/components/BulkReportView";
import type { AnalysisResult, BulkAnalysisResult } from "@/lib/experts/types";

interface Props {
  params: { locale: string; slug: string };
}

export default async function SharedReportPage({ params }: Props) {
  const record = await prisma.analysisResult.findUnique({
    where: { slug: params.slug },
  });

  if (!record) notFound();

  const data = JSON.parse(record.data) as AnalysisResult | BulkAnalysisResult;

  if ("type" in data && data.type === "bulk") {
    return (
      <BulkReportView
        result={data as BulkAnalysisResult}
        slug={params.slug}
        shared
      />
    );
  }

  return <SharedReportView result={data as AnalysisResult} slug={params.slug} />;
}
