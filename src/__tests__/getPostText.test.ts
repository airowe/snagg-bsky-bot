import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/config.js", () => ({
  snaggConfig: {
    apiUrl: "https://snagg.meme/api/v1",
    apiKey: "test-key",
  },
}));

import getPostText, { fetchRandomMeme } from "../lib/getPostText.js";

describe("getPostText", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it("returns generated meme when generation succeeds", async () => {
    const imageData = new ArrayBuffer(100);
    const headers = new Map([
      ["Content-Type", "image/webp"],
      ["X-Meme-Top-Text", encodeURIComponent("WHEN THE CODE")],
      ["X-Meme-Bottom-Text", encodeURIComponent("FINALLY COMPILES")],
      ["X-Meme-Template", encodeURIComponent("Drake")],
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => imageData,
      headers: { get: (key: string) => headers.get(key) || null },
    });

    const result = await getPostText();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://snagg.meme/api/v1/memes/generate/image",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.text).toBe("WHEN THE CODE / FINALLY COMPILES");
    expect(result.imageBuffer).toBe(imageData);
    expect(result.imageAlt).toContain("Drake");
    expect(result.imageMimeType).toBe("image/webp");
  });

  it("falls back to random meme when generation fails", async () => {
    // First call: generate fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Caption generation failed",
    });

    // Second call: random succeeds
    const mockMeme = {
      title: "Distracted Boyfriend",
      slug: "distracted-boyfriend",
      image_url: "https://cdn.snagg.meme/meme.webp",
      watermarked_image_url: "https://cdn.snagg.meme/watermarked.webp",
      ai_alt_text: "A man looking at another woman",
      tags: ["programming", "javascript", "typescript"],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { memes: [mockMeme] } }),
    });

    // Third call: image download
    const imageData = new ArrayBuffer(50);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => imageData,
      headers: { get: (key: string) => (key === "Content-Type" ? "image/webp" : null) },
    });

    const result = await getPostText();

    expect(result.text).toContain("Distracted Boyfriend");
    expect(result.text).toContain("#programming");
    expect(result.imageBuffer).toBe(imageData);
    expect(result.imageAlt).toBe("A man looking at another woman");
  });

  it("returns text-only fallback when both generation and random fail", async () => {
    // Generate fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "error",
    });

    // Random also fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const result = await getPostText();

    expect(result).toEqual({
      text: "Check out snagg.meme for fresh memes! 🔥",
    });
  });

  it("handles top-text-only generated meme", async () => {
    const imageData = new ArrayBuffer(100);
    const headers = new Map([
      ["Content-Type", "image/webp"],
      ["X-Meme-Top-Text", encodeURIComponent("ONE DOES NOT SIMPLY")],
      ["X-Meme-Bottom-Text", ""],
      ["X-Meme-Template", encodeURIComponent("Boromir")],
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => imageData,
      headers: { get: (key: string) => headers.get(key) || null },
    });

    const result = await getPostText();

    expect(result.text).toBe("ONE DOES NOT SIMPLY");
  });
});

describe("fetchRandomMeme", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it("fetches and returns a random meme with image", async () => {
    const mockMeme = {
      title: "Test Meme",
      slug: "test-meme",
      image_url: "https://cdn.snagg.meme/original.webp",
      watermarked_image_url: "https://cdn.snagg.meme/watermarked.webp",
      ai_alt_text: "A funny meme",
      description: "Description",
      tags: ["funny", "meme"],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { memes: [mockMeme] } }),
    });

    const imageData = new ArrayBuffer(200);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => imageData,
      headers: { get: (key: string) => (key === "Content-Type" ? "image/webp" : null) },
    });

    const result = await fetchRandomMeme();

    expect(result).not.toBeNull();
    expect(result!.text).toContain("Test Meme");
    expect(result!.text).toContain("#funny");
    expect(result!.imageBuffer).toBe(imageData);
    expect(result!.imageAlt).toBe("A funny meme");
    expect(result!.imageMimeType).toBe("image/webp");
    // Should fetch image URL directly (no watermark endpoint)
    expect(mockFetch).toHaveBeenCalledWith("https://cdn.snagg.meme/original.webp");
  });

  it("uses image_url when watermarked_image_url is missing", async () => {
    const mockMeme = {
      title: "Test Meme",
      slug: "test-meme",
      image_url: "https://cdn.snagg.meme/original.webp",
      ai_alt_text: null,
      description: "A description",
      tags: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { memes: [mockMeme] } }),
    });

    const imageData = new ArrayBuffer(200);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => imageData,
      headers: { get: () => null },
    });

    const result = await fetchRandomMeme();

    expect(result).not.toBeNull();
    expect(result!.imageAlt).toBe("A description");
    expect(mockFetch).toHaveBeenCalledWith("https://cdn.snagg.meme/original.webp");
  });

  it("returns null when API returns empty memes", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { memes: [] } }),
    });

    const result = await fetchRandomMeme();

    expect(result).toBeNull();
  });

  it("returns null when API fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });

    const result = await fetchRandomMeme();

    expect(result).toBeNull();
  });

  it("returns null when image download fails", async () => {
    const mockMeme = {
      title: "Test Meme",
      slug: "test-meme",
      image_url: "https://cdn.snagg.meme/original.webp",
      tags: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { memes: [mockMeme] } }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await fetchRandomMeme();

    expect(result).toBeNull();
  });

  it("includes API key in requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { memes: [] } }),
    });

    await fetchRandomMeme();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://snagg.meme/api/v1/random?count=1",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-API-Key": "test-key",
        }),
      })
    );
  });
});
