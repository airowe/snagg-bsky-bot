import type { AppBskyEmbedExternal, AppBskyEmbedImage } from "@atproto/api";

interface SnaggRandomResponse {
  url: string;
  source: string;
  nsfw: boolean;
  image?: {
    url: string;
    width: number;
    height: number;
  };
}

export interface PostRecord {
  text: string;
  embed?: AppBskyEmbedImage.Main | AppBskyEmbedExternal.Main;
  createdAt?: Date;
  facets?: Array<any>;
}

export default async function getPostText(): Promise<
  string | PostRecord
> {
  try {
    // Fetch random meme from snagg API
    const response = await fetch("https://api.snagg.meme/api/v1/random");

    if (!response.ok) {
      throw new Error(
        `Failed to fetch from snagg API: ${response.status} ${response.statusText}`
      );
    }

    const data: SnaggRandomResponse = await response.json();

    // If we have an image, download it and create an image embed
    if (data.image?.url) {
      const imageUrl = data.image.url.startsWith("http")
        ? data.image.url
        : `https://snagg.meme${data.image.url.startsWith("/") ? "" : "/"}${data.image.url}`;

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBytes = new Uint8Array(imageBuffer);

      return {
        text: "Check out this meme from snagg.meme! 🎉",
        embed: {
          $type: "app.bsky.embed.image",
          images: [
            {
              image: new Blob([imageBytes], { type: "image/jpeg" }),
              alt: "Meme from snagg.meme",
            },
          ],
        } as any,
      };
    }

    // If no image, return URL with external link card
    const memeUrl = data.url.startsWith("http")
      ? data.url
      : `https://snagg.meme${data.url.startsWith("/") ? "" : "/"}${data.url}`;

    return {
      text: "Check out this meme from snagg.meme! 🎉",
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: memeUrl,
          title: "snagg.meme",
          description: "A collection of great memes",
        },
      } as any,
    };
  } catch (error) {
    console.error("Error fetching meme:", error);
    // Fallback post if fetching fails
    return "Check out snagg.meme for some great memes! 🎉";
  }
}
