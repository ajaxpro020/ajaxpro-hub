import { noStoreHeaders } from "./discord-auth";

export const MOTM_VOTE_MAX_BODY_BYTES = 16 * 1024;
export const MOTM_MANAGE_MAX_BODY_BYTES = 32 * 1024;
export const MEDIA_WATCH_MAX_BODY_BYTES = 8 * 1024 * 1024;
export const MOTM_VOTE_MAX_FORM_FIELDS = 20;
export const MOTM_MANAGE_MAX_FORM_FIELDS = 256;
export const MEDIA_WATCH_MAX_FORM_FIELDS = 24;

const payloadTooLarge = (message: string) => new Response(message, {
  status: 413,
  headers: {
    ...noStoreHeaders,
    Allow: "POST",
    "Content-Type": "text/plain; charset=UTF-8",
  },
});

const contentLength = (request: Request) => {
  const value = request.headers.get("content-length");
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export const readFormDataWithLimits = async (
  request: Request,
  options: { maxBytes: number; maxFields: number },
): Promise<FormData | Response> => {
  const declaredLength = contentLength(request);
  if (declaredLength !== null && declaredLength > options.maxBytes) {
    return payloadTooLarge("Aanvraag is te groot.");
  }

  const reader = request.body?.getReader();
  if (!reader) return new FormData();

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > options.maxBytes) {
        await reader.cancel();
        return payloadTooLarge("Aanvraag is te groot.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const replay = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });
  const form = await replay.formData();
  let fields = 0;
  form.forEach(() => { fields += 1; });
  if (fields > options.maxFields) return payloadTooLarge("Te veel formuliergegevens.");
  return form;
};
