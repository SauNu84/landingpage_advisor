"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/navigation";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "vi", label: "VI" },
  { code: "de", label: "DE" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <div className="flex items-center gap-1">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            locale === code
              ? "bg-indigo-600 text-white"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
