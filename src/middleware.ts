import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

const locales = ["en", "vi", "de"];

function detectLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage) return "en";

  const langs = acceptLanguage
    .split(",")
    .map((lang) => {
      const [locale, q] = lang.trim().split(";q=");
      return { locale: locale.trim().toLowerCase(), q: q ? parseFloat(q) : 1.0 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { locale } of langs) {
    if (locales.includes(locale)) return locale;
    const lang = locale.split("-")[0];
    if (locales.includes(lang)) return lang;
  }

  return "en";
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only auto-detect on root path when no NEXT_LOCALE cookie is set
  if (pathname === "/" && !request.cookies.get("NEXT_LOCALE")) {
    const acceptLanguage = request.headers.get("Accept-Language");
    const detectedLocale = detectLocale(acceptLanguage);

    if (detectedLocale !== "en") {
      return NextResponse.redirect(new URL(`/${detectedLocale}`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all pathnames except API routes, _next, and static files
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
