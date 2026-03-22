"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/navigation";
import { BulkReportView } from "@/components/BulkReportView";
import type { BulkAnalysisResult } from "@/lib/experts/types";

export default function BulkPage() {
  const router = useRouter();
  const [result, setResult] = useState<BulkAnalysisResult | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("bulkResult");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      setResult(JSON.parse(raw));
    } catch {
      router.replace("/");
    }
  }, [router]);

  if (!result) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return <BulkReportView result={result} slug={result.slug} />;
}
