import Bot from "./lib/bot.js";
import getPostText from "./lib/getPostText.js";

const text = await Bot.run(getPostText, { dryRun: false });

console.log(`[${new Date().toISOString()}] Posted: "${text}"`);
