import { z } from "zod";

const TelegramSendMessageResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    result: z.object({ message_id: z.number() }).catchall(z.json()),
  }),
  z.object({
    ok: z.literal(false),
    error_code: z.number().optional(),
    description: z.string().optional(),
  }),
]);

type TelegramPayload = {
  chat_id: string;
  text: string;
  disable_web_page_preview: boolean;
  message_thread_id?: number;
};

function chunkText(text: string, maxLen: number): string[] {
  const normalized = text.replace(/\r\n/g, "\n");

  if (normalized.length <= maxLen) return [normalized];

  const chunks: string[] = [];
  let remaining = normalized;

  while (remaining.length > maxLen) {
    // Try to split on a newline near the end of the chunk.
    const candidate = remaining.slice(0, maxLen);
    const lastNewline = candidate.lastIndexOf("\n");
    const splitAt = lastNewline > maxLen * 0.6 ? lastNewline : maxLen;

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);

  return chunks;
}

export async function sendTelegramText(opts: {
  botToken: string;
  chatId: string;
  text: string;
  messageThreadId?: string;
  disableWebPreview?: boolean;
}): Promise<void> {
  const url = `https://api.telegram.org/bot${opts.botToken}/sendMessage`;
  const chunks = chunkText(opts.text, 4000);

  for (const chunk of chunks) {
    const payload: TelegramPayload = {
      chat_id: opts.chatId,
      text: chunk,
      disable_web_page_preview: opts.disableWebPreview ?? true,
    };

    if (opts.messageThreadId && opts.messageThreadId.trim().length > 0) {
      const n = Number(opts.messageThreadId);

      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
        throw new Error(`Invalid TELEGRAM_MESSAGE_THREAD_ID: "${opts.messageThreadId}"`);
      }

      payload.message_thread_id = n;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const parsed = TelegramSendMessageResponseSchema.safeParse(await res.json().catch(() => null));
    const data = parsed.success ? parsed.data : null;

    if (!res.ok || !data || data.ok !== true) {
      const details =
        data && "ok" in data && data.ok === false
          ? `${data.error_code ?? "?"} ${data.description ?? "Unknown error"}`
          : `HTTP ${res.status}`;

      throw new Error(`Telegram sendMessage failed: ${details}`);
    }
  }
}
