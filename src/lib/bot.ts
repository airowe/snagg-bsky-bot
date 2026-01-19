import { bskyAccount, bskyService } from "./config.js";
import type { AtpAgentLoginOpts, AtpAgentOptions } from "@atproto/api";
import { AtpAgent, RichText } from "@atproto/api";
import type { PostData } from "./getPostText.js";

interface BotOptions {
  service: string | URL;
  dryRun: boolean;
}

export default class Bot {
  #agent: AtpAgent;

  static defaultOptions: BotOptions = {
    service: bskyService,
    dryRun: false,
  } as const;

  constructor(service: AtpAgentOptions["service"]) {
    this.#agent = new AtpAgent({ service });
  }

  login(loginOpts: AtpAgentLoginOpts) {
    return this.#agent.login(loginOpts);
  }

  async post(postData: PostData): Promise<string> {
    const richText = new RichText({ text: postData.text });
    await richText.detectFacets(this.#agent);

    // Build the record - we'll cast to any for the embed since the AT Protocol
    // types are complex and we're building the structure correctly
    const record: Record<string, unknown> = {
      text: richText.text,
      facets: richText.facets,
    };

    // Handle image embed
    if (postData.imageUrl) {
      const imageResponse = await fetch(postData.imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBlob = new Blob([imageBuffer], {
        type: imageResponse.headers.get("content-type") || "image/jpeg",
      });

      const uploaded = await this.#agent.uploadBlob(imageBlob);

      record.embed = {
        $type: "app.bsky.embed.images",
        images: [
          {
            image: uploaded.data.blob,
            alt: postData.imageAlt || "",
          },
        ],
      };
    }
    // Handle external link card embed
    else if (postData.externalUrl) {
      record.embed = {
        $type: "app.bsky.embed.external",
        external: {
          uri: postData.externalUrl,
          title: postData.externalTitle || "",
          description: postData.externalDescription || "",
        },
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.#agent.post(record as any);
    return result.uri;
  }

  static async run(
    getPostText: () => Promise<PostData>,
    botOptions?: Partial<BotOptions>
  ) {
    const { service, dryRun } = botOptions
      ? Object.assign({}, this.defaultOptions, botOptions)
      : this.defaultOptions;

    if (!bskyAccount) {
      throw new Error("BSKY_HANDLE and BSKY_PASSWORD must be set");
    }

    const bot = new Bot(service);
    await bot.login(bskyAccount);
    const postData = await getPostText();

    if (!dryRun) {
      return await bot.post(postData);
    } else {
      console.log(postData);
      return postData.text;
    }
  }
}
