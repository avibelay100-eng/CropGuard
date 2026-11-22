/**
 * בדיקות יחידה ללקוח שירות ה-AI, מול שרת HTTP מקומי זעיר שמחקה את השירות.
 * לא צריך מסד נתונים ולא את שירות ה-AI האמיתי.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { AiServiceError, createHttpAiClient } from "../src/services/aiClient.js";
import { PNG_BYTES, prediction } from "./helpers.js";

type Handler = (request: IncomingMessage, response: ServerResponse, body: Buffer) => void;

let server: Server | null = null;

async function startFakeAi(handler: Handler): Promise<string> {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => handler(request, response, Buffer.concat(chunks)));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}

const image = { buffer: PNG_BYTES, mimetype: "image/png", filename: "leaf.png" };

async function expectAiError(promise: Promise<unknown>, kind: string, status: number): Promise<AiServiceError> {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(AiServiceError);
  expect((error as AiServiceError).kind).toBe(kind);
  expect((error as AiServiceError).status).toBe(status);
  return error as AiServiceError;
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

describe("HTTP AI client", () => {
  it("posts the image as multipart field 'image' to /predict and returns the prediction", async () => {
    let seen: { method?: string; url?: string; contentType?: string; body?: Buffer } = {};
    const url = await startFakeAi((request, response, body) => {
      seen = { method: request.method, url: request.url, contentType: request.headers["content-type"], body };
      json(response, 200, prediction("Tomato___Late_blight", 0.8995));
    });

    const result = await createHttpAiClient(url, 2000).predict(image);

    expect(result.model_label).toBe("Tomato___Late_blight");
    expect(result.confidence).toBe(0.8995);
    expect(seen.method).toBe("POST");
    // כל 38 ההסתברויות - לבדיקת ההתאמה לגידול של החלקה
    expect(seen.url).toBe("/predict?top_k=38");
    expect(seen.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(seen.body!.toString("latin1")).toContain('name="image"; filename="leaf.png"');
    expect(seen.body!.includes(PNG_BYTES)).toBe(true);
  });

  it("treats a 4xx from the AI engine as a rejected image", async () => {
    const url = await startFakeAi((_request, response) =>
      json(response, 400, { error: "bad_request", detail: "The uploaded file is not a readable image." }),
    );
    const error = await expectAiError(createHttpAiClient(url, 2000).predict(image), "rejected", 400);
    expect(error.message).toBe("The uploaded file is not a readable image.");
  });

  it("treats a 5xx from the AI engine as unavailable", async () => {
    const url = await startFakeAi((_request, response) =>
      json(response, 503, { error: "model_unavailable", detail: "Model is not available" }),
    );
    await expectAiError(createHttpAiClient(url, 2000).predict(image), "unavailable", 503);
  });

  it("treats a malformed success response as unavailable", async () => {
    const url = await startFakeAi((_request, response) => json(response, 200, { disease: "x" }));
    await expectAiError(createHttpAiClient(url, 2000).predict(image), "unavailable", 503);
  });

  it("treats a connection failure as unavailable", async () => {
    const url = await startFakeAi(() => undefined);
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
    await expectAiError(createHttpAiClient(url, 2000).predict(image), "unavailable", 503);
  });

  it("gives up after the timeout", async () => {
    const url = await startFakeAi(() => {
      /* לא עונה בכלל */
    });
    const started = Date.now();
    const error = await expectAiError(createHttpAiClient(url, 200).predict(image), "unavailable", 503);
    expect(error.message).toContain("timed out");
    expect(Date.now() - started).toBeLessThan(2000);
    server!.closeAllConnections();
  });
});
