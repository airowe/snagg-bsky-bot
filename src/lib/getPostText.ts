import { load } from "cheerio";

export default async function getPostText() {
  try {
    // Fetch the snagg.meme page
    const response = await fetch("https://snagg.meme");

    if (!response.ok) {
      throw new Error(
        `Failed to fetch snagg.meme: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();
    const $ = load(html);

    // Extract all image URLs from the page
    const imageUrls: string[] = [];
    $("img").each((_, elem) => {
      const src = $(elem).attr("src");
      if (src) {
        imageUrls.push(src);
      }
    });

    if (imageUrls.length === 0) {
      throw new Error("No images found on snagg.meme");
    }

    // Pick a random image
    const randomImage = imageUrls[Math.floor(Math.random() * imageUrls.length)];

    // Convert relative URLs to absolute if needed
    const memeUrl = randomImage.startsWith("http")
      ? randomImage
      : `https://snagg.meme${
          randomImage.startsWith("/") ? "" : "/"
        }${randomImage}`;

    // Return a post with the meme link
    return `${memeUrl}`;
  } catch (error) {
    console.error("Error fetching meme:", error);
    // Fallback post if fetching fails
    return "Check out snagg.meme for some great memes! 🎉";
  }
}
