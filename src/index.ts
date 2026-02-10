import Bot from "./lib/bot.js";
import getPostText from "./lib/getPostText.js";
import { fetchRandomMeme } from "./lib/getPostText.js";
import { bskyAccount, bskyService } from "./lib/config.js";

if (!bskyAccount) {
  throw new Error("BSKY_HANDLE and BSKY_PASSWORD must be set in environment");
}

const bot = new Bot(bskyService);
await bot.login(bskyAccount);

try {
  const postData = await getPostText();
  const uri = await bot.post(postData);
  console.log(`[${new Date().toISOString()}] Posted to Bluesky: ${uri}`);
} catch (error) {
  console.error(`[${new Date().toISOString()}] Post failed:`, error);

  // Last-resort fallback: try posting a random meme
  try {
    console.log("Attempting fallback: posting random meme...");
    const fallback = await fetchRandomMeme();
    if (fallback) {
      const uri = await bot.post(fallback);
      console.log(`[${new Date().toISOString()}] Fallback posted: ${uri}`);
    } else {
      console.error("Fallback also failed. No post made.");
      process.exit(1);
    }
  } catch (fallbackError) {
    console.error("Fallback post failed:", fallbackError);
    process.exit(1);
  }
}
