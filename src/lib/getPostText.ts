import { snaggConfig } from "./config.js";

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
  // New fields for enhanced API response
  alt_text?: string;
  watermarked_image_url?: string;
}

interface SnaggRandomResponse {
  data: {
    memes: SnaggMeme[];
  };
  error: string | null;
}

export interface PostData {
  text: string;
  imageUrl?: string;
  imageAlt?: string;
  externalUrl?: string;
  externalTitle?: string;
  externalDescription?: string;
}

export default async function getPostText(): Promise<PostData> {
  try {
    // Build request headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add API key if configured
    if (snaggConfig.apiKey) {
      headers["X-API-Key"] = snaggConfig.apiKey;
    }

    // Fetch random meme from snagg API
    const response = await fetch(`${snaggConfig.apiUrl}/random`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch from snagg API: ${response.status} ${response.statusText}`
      );
    }

    const result: SnaggRandomResponse = await response.json();

    if (result.error) {
      throw new Error(`Snagg API error: ${result.error}`);
    }

    const meme = result.data.memes[0];
    if (!meme) {
      throw new Error("No memes returned from API");
    }

    // Build the meme page URL for the link
    const memePageUrl = `https://snagg.meme/meme/${meme.slug}`;

    // Prefer watermarked image URL if available, otherwise use original
    const imageUrl = meme.watermarked_image_url || meme.image_url;

    // Use API-provided alt_text if available, otherwise fall back to description/title
    const imageAlt =
      meme.alt_text || meme.description || meme.title || "Meme from snagg.meme";

    return {
      text: meme.title || "Check out this meme from snagg.meme!",
      imageUrl,
      imageAlt,
      externalUrl: memePageUrl,
    };
  } catch (error) {
    console.error("Error fetching meme:", error);
    // Fallback post if fetching fails
    return { text: "Check out snagg.meme for some great memes!" };
  }
}
