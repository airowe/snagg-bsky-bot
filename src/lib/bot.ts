import { bskyAccount, bskyService } from "./config.js";
import type {
  AppBskyFeedPost,
  AtpAgentLoginOpts,
  AtpAgentOptions,
} from "@atproto/api";
import { AtpAgent, RichText } from "@atproto/api";
import type { PostRecord } from "./getPostText.js";

interface BotOptions {
  service: string | URL;
  dryRun: boolean;
}

export default class Bot {
  #agent;

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

  async post(
    text:
      | string
      | PostRecord
      | (
        & Partial<AppBskyFeedPost.Record>
        & Omit<AppBskyFeedPost.Record, "createdAt">
      ),
  ) {
    if (typeof text === "string") {
      const richText = new RichText({ text });
      await richText.detectFacets(this.#agent);
      const record = {
        text: richText.text,
        facets: richText.facets,
      };
      return this.#agent.post(record);
    } else if ("text" in text && "embed" in text) {
      // Handle PostRecord with embeds (images or external links)
      const richText = new RichText({ text: text.text });
      await richText.detectFacets(this.#agent);

      let embed;
      if (text.embed) {
        if ((text.embed as any).$type === "app.bsky.embed.image") {
          // Handle image embed
          const imageEmbed = text.embed as any;
          const images = await Promise.all(
            imageEmbed.images.map(async (img: any) => {
              let blob: Blob;
              if (img.image instanceof Blob) {
                blob = img.image;
              } else if (typeof img.image === "string") {
                const response = await fetch(img.image);
                blob = await response.blob();
              } else {
                throw new Error("Invalid image data");
              }

              const uploadedImage = await this.#agent.uploadBlob(blob);
              return {
                image: uploadedImage.blob,
                alt: img.alt || "",
              };
            })
          );

          embed = {
            $type: "app.bsky.embed.image",
            images,
          };
        } else if ((text.embed as any).$type === "app.bsky.embed.external") {
          // Handle external link embed
          embed = text.embed;
        }
      }

      const record: any = {
        text: richText.text,
        facets: richText.facets,
      };

      if (embed) {
        record.embed = embed;
      }

      return this.#agent.post(record);
    } else {
      return this.#agent.post(text);
    }
  }

  static async run(
    getPostText: () => Promise<string>,
    botOptions?: Partial<BotOptions>,
  ) {
    const { service, dryRun } = botOptions
      ? Object.assign({}, this.defaultOptions, botOptions)
      : this.defaultOptions;
    const bot = new Bot(service);
    await bot.login(bskyAccount);
    const text = (await getPostText()).trim();
    if (!dryRun) {
      await bot.post(text);
    } else {
      console.log(text);
    }
    return text;
  }
}
