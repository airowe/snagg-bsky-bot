import { snaggConfig } from "./config.js";

export interface PostData {
  text: string;
  imageBuffer?: ArrayBuffer;
  imageAlt?: string;
  imageMimeType?: string;
}

/**
 * Fetches an AI-generated meme from the Snagg API.
 * Falls back to a random existing meme if generation fails.
 */
export default async function getPostText(): Promise<PostData> {
  const generated = await fetchGeneratedMeme();
  if (generated) return generated;

  console.log("[getPostText] Generation failed, falling back to random meme...");

  const random = await fetchRandomMeme();
  if (random) return random;

  console.error("[getPostText] Both generation and random meme fetch failed");
  return { text: "Check out snagg.meme for fresh memes! 🔥" };
}

async function fetchGeneratedMeme(): Promise<PostData | null> {
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
      console.error(
        `[getPostText] Generate failed: ${response.status} ${response.statusText} - ${errorText}`
      );
      return null;
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("Content-Type") || "image/webp";

    const topText = decodeURIComponent(response.headers.get("X-Meme-Top-Text") || "");
    const bottomText = decodeURIComponent(response.headers.get("X-Meme-Bottom-Text") || "");
    const templateName = decodeURIComponent(response.headers.get("X-Meme-Template") || "");

    console.log(
      `[getPostText] Generated meme - Template: ${templateName}, Top: "${topText}", Bottom: "${bottomText}"`
    );

    let postText = "";
    if (topText && bottomText) {
      postText = `${topText} / ${bottomText}`;
    } else if (topText || bottomText) {
      postText = topText || bottomText;
    } else {
      postText = "Fresh meme from snagg.meme 🔥";
    }

    const altParts = ["Meme"];
    if (templateName) altParts.push(`(${templateName})`);
    if (topText) altParts.push(`Top text: "${topText}"`);
    if (bottomText) altParts.push(`Bottom text: "${bottomText}"`);

    return {
      text: postText,
      imageBuffer,
      imageAlt: altParts.join(" - "),
      imageMimeType: contentType,
    };
  } catch (error) {
    console.error("[getPostText] Error generating meme:", error);
    return null;
  }
}

export async function fetchRandomMeme(): Promise<PostData | null> {
  try {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (snaggConfig.apiKey) {
      headers["X-API-Key"] = snaggConfig.apiKey;
    }

    console.log("[getPostText] Fetching random meme...");

    const response = await fetch(`${snaggConfig.apiUrl}/random?count=1`, {
      headers,
    });

    if (!response.ok) {
      console.error(
        `[getPostText] Random fetch failed: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const json = await response.json();
    const memes = json?.data?.memes;

    if (!memes || memes.length === 0) {
      console.error("[getPostText] No memes returned from random endpoint");
      return null;
    }

    const meme = memes[0];
    const imageUrl = meme.image_url;

    console.log(
      `[getPostText] Random meme: "${meme.title}" (${imageUrl})`
    );

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error(
        `[getPostText] Failed to download image: ${imageResponse.status}`
      );
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType =
      imageResponse.headers.get("Content-Type") || "image/webp";

    const tags = (meme.tags as string[])?.slice(0, 3) || [];
    const hashtags = tags.map((t: string) => `#${t.replace(/\s+/g, "")}`);

    let postText = meme.title || "Fresh meme from snagg.meme";
    if (hashtags.length > 0) {
      postText += `\n\n${hashtags.join(" ")}`;
    }

    return {
      text: postText,
      imageBuffer,
      imageAlt: meme.ai_alt_text || meme.description || meme.title,
      imageMimeType: contentType,
    };
  } catch (error) {
    console.error("[getPostText] Error fetching random meme:", error);
    return null;
  }
}
