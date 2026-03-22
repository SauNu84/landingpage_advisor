"use client";

import { useTranslations } from "next-intl";

interface LoadingExpertProps {
  experts: string[];
  currentIndex: number;
}

export function LoadingExpert({ experts, currentIndex }: LoadingExpertProps) {
  const t = useTranslations("LoadingExpert");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <svg
              className="w-8 h-8 text-white animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.346A3.36 3.36 0 0114 17H10a3.36 3.36 0 01-2.39-.991l-.346-.346z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t("title")}
          </h2>
          <p className="text-gray-500 text-sm">{t("subtitle")}</p>
        </div>

        {/* Expert progress list */}
        <div className="space-y-3">
          {experts.map((expert, i) => {
            const isDone = i < currentIndex;
            const isActive = i === currentIndex;
            const isPending = i > currentIndex;

            return (
              <div
                key={expert}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-indigo-50 border border-indigo-200"
                    : isDone
                    ? "bg-green-50 border border-green-100"
                    : "bg-white border border-gray-100"
                }`}
              >
                <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
                  {isDone ? (
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : isActive ? (
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-gray-200" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive
                      ? "text-indigo-700"
                      : isDone
                      ? "text-green-700"
                      : "text-gray-400"
                  }`}
                >
                  {expert}
                </span>
                {isActive && (
                  <span className="ml-auto text-xs text-indigo-500 animate-pulse">
                    {t("analyzing")}
                  </span>
                )}
                {isDone && (
                  <span className="ml-auto text-xs text-green-600">{t("done")}</span>
                )}
                {isPending && (
                  <span className="ml-auto text-xs text-gray-300">
                    {t("waiting")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
