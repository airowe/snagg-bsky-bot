import { describe, it, expect, beforeAll } from "vitest";

interface SnaggMeme {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string;
  thumbnail_url: string;
  image_width: number | null;
  image_height: number | null;
  categories: string[];
  tags: string[];
  is_nsfw: boolean;
  source_url: string | null;
  alt_text?: string;
  watermarked_image_url?: string;
}

interface SnaggRandomResponse {
  data: {
    memes: SnaggMeme[];
  } | null;
  error: string | null;
}

describe("Snagg API Integration Tests", () => {
  const API_URL = "https://snagg.meme/api/v1/random";
  let cachedMeme: SnaggMeme | null = null;
  let apiAvailable = true;

  // Fetch once and cache to avoid rate limits
  beforeAll(async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        console.log(`API returned ${response.status}, some tests will be skipped`);
        apiAvailable = false;
        return;
      }
      const data: SnaggRandomResponse = await response.json();
      if (data.data?.memes?.[0]) {
        cachedMeme = data.data.memes[0];
      } else {
        apiAvailable = false;
      }
    } catch (error) {
      console.log("API unavailable, integration tests will be skipped");
      apiAvailable = false;
    }
  });

  it("should return valid JSON response", async () => {
    if (!apiAvailable) {
      console.log("Skipping - API unavailable");
      return;
    }
    expect(cachedMeme).not.toBeNull();
  });

  it("should return meme with required fields", async () => {
    if (!apiAvailable || !cachedMeme) {
      console.log("Skipping - API unavailable");
      return;
    }

    // Required fields check
    expect(cachedMeme.id).toBeDefined();
    expect(typeof cachedMeme.id).toBe("string");

    expect(cachedMeme.title).toBeDefined();
    expect(typeof cachedMeme.title).toBe("string");

    expect(cachedMeme.slug).toBeDefined();
    expect(typeof cachedMeme.slug).toBe("string");

    expect(cachedMeme.image_url).toBeDefined();
    expect(typeof cachedMeme.image_url).toBe("string");
    expect(cachedMeme.image_url).toMatch(/^https?:\/\//);

    expect(typeof cachedMeme.is_nsfw).toBe("boolean");
  });

  it("should return accessible image URL", async () => {
    if (!apiAvailable || !cachedMeme) {
      console.log("Skipping - API unavailable");
      return;
    }

    // Verify the image is actually accessible
    const imageResponse = await fetch(cachedMeme.image_url);
    expect(imageResponse.ok).toBe(true);

    const contentType = imageResponse.headers.get("content-type");
    expect(contentType).toMatch(/^image\//);

    console.log("\n=== Meme Info ===");
    console.log("Title:", cachedMeme.title);
    console.log("Image URL:", cachedMeme.image_url);
    console.log("Image Content-Type:", contentType);
    console.log("Dimensions:", cachedMeme.image_width, "x", cachedMeme.image_height);

    // Check for new fields
    console.log("Alt Text:", cachedMeme.alt_text || "(not provided by API)");
    console.log("Watermarked URL:", cachedMeme.watermarked_image_url || "(not provided by API)");
  });

  it("should verify image can be fetched as blob for Bluesky upload", async () => {
    if (!apiAvailable || !cachedMeme) {
      console.log("Skipping - API unavailable");
      return;
    }

    const imageResponse = await fetch(cachedMeme.image_url);
    const imageBuffer = await imageResponse.arrayBuffer();

    // Check we got actual image data
    expect(imageBuffer.byteLength).toBeGreaterThan(0);

    // Check it's a reasonable image size (> 1KB, < 10MB)
    expect(imageBuffer.byteLength).toBeGreaterThan(1024);
    expect(imageBuffer.byteLength).toBeLessThan(10 * 1024 * 1024);

    console.log("\n=== Image Fetch Test ===");
    console.log("Image size:", Math.round(imageBuffer.byteLength / 1024), "KB");

    // Check PNG/JPEG magic bytes
    const bytes = new Uint8Array(imageBuffer);
    const isPNG =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;
    const isJPEG = bytes[0] === 0xff && bytes[1] === 0xd8;
    const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
    const isWebP =
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;

    console.log(
      "Format detected:",
      isPNG ? "PNG" : isJPEG ? "JPEG" : isGIF ? "GIF" : isWebP ? "WebP" : "Unknown"
    );
    expect(isPNG || isJPEG || isGIF || isWebP).toBe(true);
  });
});

describe("API Security & Feature Recommendations", () => {
  it("should document current API response and recommendations", async () => {
    const response = await fetch("https://snagg.meme/api/v1/random");

    console.log("\n=== API Response Analysis ===");
    console.log("Status:", response.status);

    if (!response.ok) {
      console.log("API returned error - likely rate limited");
      console.log("This is actually GOOD - rate limiting is working!");
      return;
    }

    const data: SnaggRandomResponse = await response.json();

    console.log("\n=== Security Headers ===");
    const securityHeaders = [
      "strict-transport-security",
      "x-content-type-options",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
    ];

    for (const header of securityHeaders) {
      const value = response.headers.get(header);
      console.log(`${header}: ${value || "(missing)"}`);
    }

    console.log("\n=== Current Response Fields ===");
    if (data.data?.memes?.[0]) {
      const meme = data.data.memes[0];
      console.log("Fields present:", Object.keys(meme).join(", "));

      console.log("\n=== Recommended New Fields ===");
      console.log("alt_text:", meme.alt_text ? "✓ Present" : "✗ Missing - RECOMMENDED");
      console.log("watermarked_image_url:", meme.watermarked_image_url ? "✓ Present" : "✗ Missing - RECOMMENDED");
    }
  });
});
