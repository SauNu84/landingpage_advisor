/**
 * Tests: src/lib/posthog-client.ts
 * testPostHogConnection and getProjectEvents
 */

import { testPostHogConnection, getProjectEvents } from "@/lib/posthog-client";

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => data,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── testPostHogConnection ──────────────────────────────────────────────────

describe("testPostHogConnection", () => {
  it("returns ok:true with projectName on success", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ id: 1, name: "My App" }));
    const result = await testPostHogConnection("123", "phc_key", "https://app.posthog.com");
    expect(result).toEqual({ ok: true, projectName: "My App" });
  });

  it("calls correct URL", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ id: 1, name: "P" }));
    await testPostHogConnection("456", "phc_key", "https://app.posthog.com");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://app.posthog.com/api/projects/456/",
      expect.objectContaining({
        headers: { Authorization: "Bearer phc_key" },
      })
    );
  });

  it("returns ok:false with error on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}, 401));
    const result = await testPostHogConnection("123", "bad_key", "https://app.posthog.com");
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/401/) });
  });

  it("returns ok:false with error message on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network timeout"));
    const result = await testPostHogConnection("123", "phc_key", "https://app.posthog.com");
    expect(result).toEqual({ ok: false, error: "Network timeout" });
  });

  it("returns ok:false with generic message on non-Error throw", async () => {
    mockFetch.mockRejectedValue("string error");
    const result = await testPostHogConnection("123", "phc_key", "https://app.posthog.com");
    expect(result).toEqual({ ok: false, error: "Connection failed" });
  });

  it("falls back to project ID in name when name is missing", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ id: 99 }));
    const result = await testPostHogConnection("99", "phc_key", "https://app.posthog.com");
    expect(result).toEqual({ ok: true, projectName: "Project 99" });
  });
});

// ── getProjectEvents ───────────────────────────────────────────────────────

describe("getProjectEvents", () => {
  const fakeEvents = [
    { id: "e1", name: "pageview", last_seen_at: "2024-01-01", volume_30_day: 1000 },
    { id: "e2", name: "click", last_seen_at: null, volume_30_day: null },
  ];

  it("returns event definitions on success", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ results: fakeEvents }));
    const events = await getProjectEvents("123", "phc_key", "https://app.posthog.com");
    expect(events).toEqual(fakeEvents);
  });

  it("calls correct URL with limit and ordering", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ results: [] }));
    await getProjectEvents("789", "phc_key", "https://app.posthog.com");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/789/event_definitions/"),
      expect.any(Object)
    );
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("limit=500");
    expect(url).toContain("order_by=-volume_30_day");
  });

  it("returns empty array when results field is missing", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}));
    const events = await getProjectEvents("123", "phc_key", "https://app.posthog.com");
    expect(events).toEqual([]);
  });

  it("throws on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}, 403));
    await expect(getProjectEvents("123", "bad_key", "https://app.posthog.com")).rejects.toThrow(
      /PostHog API error/i
    );
  });
});
