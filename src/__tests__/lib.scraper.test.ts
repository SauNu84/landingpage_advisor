/**
 * Tests: src/lib/scraper.ts
 * Private host blocking, protocol validation, fetch errors, HTML parsing
 */

import { scrapePage } from "@/lib/scraper";

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeHtmlResponse(html: string, options: { status?: number; headers?: Record<string, string> } = {}) {
  const status = options.status ?? 200;
  const headers = new Headers({ "Content-Type": "text/html", ...options.headers });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers,
    text: async () => html,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── private host blocking ──────────────────────────────────────────────────

describe("scrapePage — private host blocking", () => {
  const privateHosts = [
    "http://localhost/page",
    "http://127.0.0.1/page",
    "http://10.0.0.1/page",
    "http://192.168.1.1/page",
    "http://172.16.0.1/page",
    "http://0.0.0.0/page",
  ];

  for (const url of privateHosts) {
    it(`blocks ${url}`, async () => {
      await expect(scrapePage(url)).rejects.toThrow(/private|internal/i);
    });
  }
});

// ── protocol validation ────────────────────────────────────────────────────

describe("scrapePage — protocol validation", () => {
  it("rejects ftp:// protocol", async () => {
    await expect(scrapePage("ftp://example.com/page")).rejects.toThrow(/unsupported protocol/i);
  });

  it("rejects file:// protocol", async () => {
    await expect(scrapePage("file:///etc/passwd")).rejects.toThrow(/unsupported protocol/i);
  });
});

// ── fetch errors ───────────────────────────────────────────────────────────

describe("scrapePage — fetch errors", () => {
  it("throws when HTTP response is not ok", async () => {
    mockFetch.mockResolvedValue(makeHtmlResponse("", { status: 404 }));
    await expect(scrapePage("https://example.com/notfound")).rejects.toThrow(/404/);
  });

  it("throws when response is too large (content-length header)", async () => {
    mockFetch.mockResolvedValue(
      makeHtmlResponse("", { headers: { "content-length": String(6 * 1024 * 1024) } })
    );
    await expect(scrapePage("https://example.com")).rejects.toThrow(/too large/i);
  });

  it("propagates network errors", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(scrapePage("https://example.com")).rejects.toThrow("ECONNREFUSED");
  });
});

// ── HTML parsing ───────────────────────────────────────────────────────────

describe("scrapePage — HTML parsing", () => {
  const sampleHtml = `
    <html>
      <head>
        <title>My Landing Page</title>
        <meta name="description" content="Best product ever">
        <meta property="og:description" content="OG description">
        <link rel="canonical" href="https://example.com/canonical">
      </head>
      <body>
        <h1>Main Headline</h1>
        <h2>Subheading One</h2>
        <h2>Subheading Two</h2>
        <h3>Minor heading</h3>
        <button>Get Started</button>
        <a href="/signup">Sign Up</a>
        <input type="text" placeholder="Enter email" name="email" />
        <label>Your Name</label>
        <p>Body copy text here</p>
        <script>var x = 1;</script>
        <style>body { color: red; }</style>
      </body>
    </html>
  `;

  beforeEach(() => {
    mockFetch.mockResolvedValue(makeHtmlResponse(sampleHtml));
  });

  it("returns the page URL", async () => {
    const result = await scrapePage("https://example.com");
    expect(result.url).toBe("https://example.com");
  });

  it("extracts the title", async () => {
    const result = await scrapePage("https://example.com");
    expect(result.title).toBe("My Landing Page");
  });

  it("extracts the meta description", async () => {
    const result = await scrapePage("https://example.com");
    expect(result.description).toBe("Best product ever");
  });

  it("extracts headings", async () => {
    const result = await scrapePage("https://example.com");
    expect(result.headings.h1).toContain("Main Headline");
    expect(result.headings.h2).toContain("Subheading One");
    expect(result.headings.h2).toContain("Subheading Two");
    expect(result.headings.h3).toContain("Minor heading");
  });

  it("extracts CTA texts", async () => {
    const result = await scrapePage("https://example.com");
    expect(result.ctaTexts).toContain("Get Started");
    expect(result.ctaTexts).toContain("Sign Up");
  });

  it("extracts form fields", async () => {
    const result = await scrapePage("https://example.com");
    expect(result.formFields).toContain("Enter email");
    expect(result.formFields).toContain("Your Name");
  });

  it("extracts meta tags including canonical", async () => {
    const result = await scrapePage("https://example.com");
    expect(result.metaTags["canonical"]).toBe("https://example.com/canonical");
    expect(result.metaTags["description"]).toBe("Best product ever");
  });

  it("strips script and style content from body copy", async () => {
    const result = await scrapePage("https://example.com");
    expect(result.bodyCopy).not.toContain("var x = 1");
    expect(result.bodyCopy).not.toContain("color: red");
  });

  it("returns bodyCopy as string", async () => {
    const result = await scrapePage("https://example.com");
    expect(typeof result.bodyCopy).toBe("string");
  });

  it("deduplicates CTA texts", async () => {
    const dupHtml = `
      <html><body>
        <button>Click Me</button>
        <button>Click Me</button>
      </body></html>
    `;
    mockFetch.mockResolvedValue(makeHtmlResponse(dupHtml));
    const result = await scrapePage("https://example.com");
    const count = result.ctaTexts.filter((t) => t === "Click Me").length;
    expect(count).toBe(1);
  });

  it("falls back to h1 text when no <title>", async () => {
    const noTitleHtml = `<html><body><h1>Fallback Heading</h1></body></html>`;
    mockFetch.mockResolvedValue(makeHtmlResponse(noTitleHtml));
    const result = await scrapePage("https://example.com");
    expect(result.title).toBe("Fallback Heading");
  });
});
