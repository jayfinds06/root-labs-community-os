import { describe, expect, test } from "bun:test";
import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import { getDiscordOpsConfig } from "../config";

const SAMPLE_LIMIT = 5;
const DISALLOWED_INTENTS_ERROR = "Used disallowed intents";
const MISSING_ACCESS_ERROR_CODE = 50001;

const isDisallowedIntentsError = (error: unknown): boolean => {
  return (
    error instanceof Error && error.message.includes(DISALLOWED_INTENTS_ERROR)
  );
};

const isMissingAccessError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybeCode = "code" in error ? error.code : null;
  return maybeCode === MISSING_ACCESS_ERROR_CODE || error.message.includes("Missing Access");
};

const buildGatewayIntents = (
  enableMessageContentIntent: boolean,
): GatewayIntentBits[] => {
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];

  if (enableMessageContentIntent) {
    intents.push(GatewayIntentBits.MessageContent);
  }

  return intents;
};

describe("discord channel message shape", () => {
  test("fetches a few live messages from the monitored channel and validates their shape", async () => {
    const config = getDiscordOpsConfig();
    const botToken = config.botToken;
    const testChannelId = config.monitoredChannelIds[0] ?? null;

    if (!botToken) {
      console.warn(
        "[discord.shape-test] skipped: missing DISCORD_BOT_TOKEN / DISCORD_TOKEN",
      );
      return;
    }
    if (!testChannelId) {
      console.warn(
        "[discord.shape-test] skipped: missing DISCORD_MONITORED_CHANNEL_IDS",
      );
      return;
    }

    let client = new Client({
      intents: buildGatewayIntents(config.enableMessageContentIntent),
    });

    try {
      try {
        await client.login(botToken);
      } catch (error) {
        if (
          !config.enableMessageContentIntent ||
          !isDisallowedIntentsError(error)
        ) {
          throw error;
        }

        console.warn(
          "[discord.shape-test] Message Content intent is disallowed for this bot; retrying without it.",
        );
        client.destroy();
        client = new Client({ intents: buildGatewayIntents(false) });
        await client.login(botToken);
      }

      let channel: Awaited<ReturnType<Client["channels"]["fetch"]>> = null;
      for (const candidateId of config.monitoredChannelIds) {
        try {
          const candidate = await client.channels.fetch(candidateId);
          if (candidate?.type === ChannelType.GuildText) {
            channel = candidate;
            break;
          }
        } catch (error) {
          if (isMissingAccessError(error)) {
            console.warn(
              `[discord.shape-test] skipping inaccessible channel ${candidateId}`,
            );
            continue;
          }

          throw error;
        }
      }

      if (!channel || channel.type !== ChannelType.GuildText) {
        console.warn(
          "[discord.shape-test] skipped: no monitored channel is accessible to the configured bot token",
        );
        return;
      }

      expect(channel).toBeTruthy();
      expect(channel?.type).toBe(ChannelType.GuildText);

      const batch = await channel.messages.fetch({ limit: SAMPLE_LIMIT });
      const messages = [...batch.values()].sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp,
      );

      expect(messages.length).toBeGreaterThan(0);

      const sample = messages.map((message) => ({
        id: message.id,
        type: message.type,
        createdTimestamp: message.createdTimestamp,
        authorId: message.author?.id ?? null,
        username: message.author?.username ?? null,
        message: message.content,
        contentLength: message.content.length,
        cleanContentLength: message.cleanContent.length,
        hasEmbeds: message.embeds.length > 0,
        hasAttachments: message.attachments.size > 0,
        hasStickers: message.stickers.size > 0,
        system: message.system,
        webhookId: message.webhookId ?? null,
      }));

      console.info("[discord.shape-test] sample", sample);

      for (const message of messages) {
        expect(typeof message.id).toBe("string");
        expect(message.id.length).toBeGreaterThan(0);
        expect(typeof message.content).toBe("string");
        expect(typeof message.cleanContent).toBe("string");
        expect(typeof message.createdTimestamp).toBe("number");
        expect(message.createdTimestamp).toBeGreaterThan(0);
        expect(message.author).toBeTruthy();
        expect(typeof message.author.username).toBe("string");
      }
    } finally {
      client.destroy();
    }
  });
});
