import { snaggConfig } from "./config.js";

export interface PostData {
  text: string;
  imageBuffer?: ArrayBuffer;
  imageAlt?: string;
}

/**
 * Fetches an AI-generated meme from the Snagg API.
 * The /memes/generate/image endpoint:
 * 1. Picks a random meme template
 * 2. Generates a caption using AI based on trending Bluesky topics
 * 3. Renders the text onto the image server-side
 * 4. Returns the final PNG with text baked in
 */
export default async function getPostText(): Promise<PostData> {
  try {
    const headers: HeadersInit = {};

    if (snaggConfig.apiKey) {
      headers["X-API-Key"] = snaggConfig.apiKey;
    }

    console.log("[getPostText] Fetching AI-generated meme...");

    const response = await fetch(`${snaggConfig.apiUrl}/memes/generate/image`, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to generate meme: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // The response body IS the image (PNG)
    const imageBuffer = await response.arrayBuffer();

    // Caption text is in response headers (URL-encoded since HTTP headers are ASCII-only)
    const topText = decodeURIComponent(response.headers.get("X-Meme-Top-Text") || "");
    const bottomText = decodeURIComponent(response.headers.get("X-Meme-Bottom-Text") || "");
    const templateName = decodeURIComponent(response.headers.get("X-Meme-Template") || "");

    console.log(
      `[getPostText] Generated meme - Template: ${templateName}, Top: "${topText}", Bottom: "${bottomText}"`
    );

    // Build post text from the caption
    let postText = "";
    if (topText && bottomText) {
      postText = `${topText} / ${bottomText}`;
    } else if (topText || bottomText) {
      postText = topText || bottomText;
    } else {
      postText = "Fresh meme from snagg.meme 🔥";
    }

    // Build alt text for accessibility
    const altParts = ["Meme"];
    if (templateName) altParts.push(`(${templateName})`);
    if (topText) altParts.push(`Top text: "${topText}"`);
    if (bottomText) altParts.push(`Bottom text: "${bottomText}"`);
    const imageAlt = altParts.join(" - ");

    return {
      text: postText,
      imageBuffer,
      imageAlt,
    };
  } catch (error) {
    console.error("[getPostText] Error generating meme:", error);
    // Fallback post if generation fails
    return { text: "Check out snagg.meme for fresh memes! 🔥" };
  }
}
