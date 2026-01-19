import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the config module before importing getPostText
vi.mock("../lib/config.js", () => ({
  snaggConfig: {
    apiUrl: "https://snagg.meme/api/v1",
    apiKey: undefined,
  },
}));

import getPostText from "../lib/getPostText.js";

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

  it("should fetch and parse a meme from the snagg API", async () => {
    const mockMeme = {
      id: "test-id",
      title: "Test Meme Title",
      slug: "test-meme-title",
      description: "A funny test meme",
      image_url: "https://example.com/meme.png",
      thumbnail_url: "https://example.com/meme-thumb.png",
      image_width: 500,
      image_height: 500,
      categories: ["programming"],
      tags: ["test"],
      is_nsfw: false,
      source_url: null,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { memes: [mockMeme] },
        error: null,
      }),
    });

    const result = await getPostText();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://snagg.meme/api/v1/random",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
    expect(result).toEqual({
      text: "Test Meme Title",
      imageUrl: "https://example.com/meme.png",
      imageAlt: "A funny test meme",
      externalUrl: "https://snagg.meme/meme/test-meme-title",
    });
  });

  it("should prefer watermarked_image_url when available", async () => {
    const mockMeme = {
      id: "test-id",
      title: "Watermarked Meme",
      slug: "watermarked-meme",
      description: null,
      image_url: "https://example.com/original.png",
      watermarked_image_url: "https://example.com/watermarked.png",
      thumbnail_url: "https://example.com/thumb.png",
      image_width: 500,
      image_height: 500,
      categories: [],
      tags: [],
      is_nsfw: false,
      source_url: null,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { memes: [mockMeme] },
        error: null,
      }),
    });

    const result = await getPostText();

    expect(result.imageUrl).toBe("https://example.com/watermarked.png");
  });

  it("should prefer alt_text when available", async () => {
    const mockMeme = {
      id: "test-id",
      title: "Meme With Alt Text",
      slug: "meme-with-alt-text",
      description: "Generic description",
      alt_text: "A detailed accessibility description of the meme content",
      image_url: "https://example.com/meme.png",
      thumbnail_url: "https://example.com/thumb.png",
      image_width: 500,
      image_height: 500,
      categories: [],
      tags: [],
      is_nsfw: false,
      source_url: null,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { memes: [mockMeme] },
        error: null,
      }),
    });

    const result = await getPostText();

    expect(result.imageAlt).toBe(
      "A detailed accessibility description of the meme content"
    );
  });

  it("should use title as alt text when description is null", async () => {
    const mockMeme = {
      id: "test-id",
      title: "Meme Without Description",
      slug: "meme-without-description",
      description: null,
      image_url: "https://example.com/meme.png",
      thumbnail_url: "https://example.com/meme-thumb.png",
      image_width: 500,
      image_height: 500,
      categories: [],
      tags: [],
      is_nsfw: false,
      source_url: null,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { memes: [mockMeme] },
        error: null,
      }),
    });

    const result = await getPostText();

    expect(result.imageAlt).toBe("Meme Without Description");
  });

  it("should return fallback text when API fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const result = await getPostText();

    expect(result).toEqual({
      text: "Check out snagg.meme for some great memes!",
    });
  });

  it("should return fallback text when API returns error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { memes: [] },
        error: "Something went wrong",
      }),
    });

    const result = await getPostText();

    expect(result).toEqual({
      text: "Check out snagg.meme for some great memes!",
    });
  });

  it("should return fallback text when no memes returned", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { memes: [] },
        error: null,
      }),
    });

    const result = await getPostText();

    expect(result).toEqual({
      text: "Check out snagg.meme for some great memes!",
    });
  });
});
