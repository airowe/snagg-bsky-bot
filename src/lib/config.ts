import { env } from "node:process";
import { z } from "zod";
import type { AtpAgentLoginOpts } from "@atproto/api";

const envSchema = z.object({
  BSKY_HANDLE: z.string().min(1).optional(),
  BSKY_PASSWORD: z.string().min(1).optional(),
  BSKY_SERVICE: z.string().min(1).default("https://bsky.social"),
  MASTODON_INSTANCE: z.string().min(1).optional(),
  MASTODON_ACCESS_TOKEN: z.string().min(1).optional(),
  THREADS_ACCESS_TOKEN: z.string().min(1).optional(),
  THREADS_USER_ID: z.string().min(1).optional(),
  SNAGG_API_KEY: z.string().min(1).optional(),
  SNAGG_API_URL: z.string().min(1).default("https://snagg.meme/api/v1"),
});

const parsed = envSchema.parse(env);

export const bskyAccount: AtpAgentLoginOpts | null =
  parsed.BSKY_HANDLE && parsed.BSKY_PASSWORD
    ? {
        identifier: parsed.BSKY_HANDLE,
        password: parsed.BSKY_PASSWORD,
      }
    : null;

export const bskyService = parsed.BSKY_SERVICE;

export const mastodonConfig = parsed.MASTODON_INSTANCE &&
  parsed.MASTODON_ACCESS_TOKEN && {
    instance: parsed.MASTODON_INSTANCE,
    accessToken: parsed.MASTODON_ACCESS_TOKEN,
  };

export const threadsConfig = parsed.THREADS_ACCESS_TOKEN &&
  parsed.THREADS_USER_ID && {
    accessToken: parsed.THREADS_ACCESS_TOKEN,
    userId: parsed.THREADS_USER_ID,
  };

export const snaggConfig = {
  apiUrl: parsed.SNAGG_API_URL,
  apiKey: parsed.SNAGG_API_KEY,
};
