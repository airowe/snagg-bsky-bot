import Bot from "./lib/bot.js";
import getPostText from "./lib/getPostText.js";
import { bskyAccount, bskyService } from "./lib/config.js";

if (!bskyAccount) {
  throw new Error("BSKY_HANDLE and BSKY_PASSWORD must be set in environment");
}

const bot = new Bot(bskyService);
await bot.login(bskyAccount);

const postData = await getPostText();
const uri = await bot.post(postData);

console.log(`[${new Date().toISOString()}] Posted to Bluesky: ${uri}`);
