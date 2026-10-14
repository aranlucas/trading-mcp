import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { sendTelegramText } from "@/scripts/lib/telegram.js";

const MessagePayloadSchema = z.object({
  chat_id: z.string(),
  text: z.string(),
  disable_web_page_preview: z.boolean(),
  message_thread_id: z.number().optional(),
});

const options = { botToken: "test-token", chatId: "test-chat", text: "a".repeat(4001) };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Telegram delivery", () => {
  it("sends chunks in order without overlapping requests", async () => {
    const first = Promise.withResolvers<Response>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(Response.json({ ok: true, result: { message_id: 2 } }));
    vi.stubGlobal("fetch", fetchMock);

    const delivery = sendTelegramText({ ...options, messageThreadId: "12" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    first.resolve(Response.json({ ok: true, result: { message_id: 1 } }));
    await delivery;

    const payloads = fetchMock.mock.calls.map(([, init]) =>
      MessagePayloadSchema.parse(JSON.parse(z.string().parse(init?.body))),
    );
    expect(payloads.map((payload) => payload.text.length)).toEqual([4000, 1]);
    expect(payloads.map((payload) => payload.message_thread_id)).toEqual([12, 12]);
    expect(payloads.map((payload) => payload.chat_id)).toEqual(["test-chat", "test-chat"]);
  });

  it("does not send later chunks after a failure", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ ok: false, error_code: 400, description: "rejected" }, { status: 400 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendTelegramText(options)).rejects.toThrow(
      "Telegram sendMessage failed: 400 rejected",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid topic before sending anything", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendTelegramText({ ...options, messageThreadId: "0" })).rejects.toThrow(
      'Invalid TELEGRAM_MESSAGE_THREAD_ID: "0"',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
