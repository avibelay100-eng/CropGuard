/**
 * בדיקות ה-API של CropGuard AI Engine.
 * הבדיקות רצות מול המודל האמיתי (cropora_model.onnx) ולא מול מודל מזויף.
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prepareImage } from "../src/imageProcessing.js";
import { gradientPng, imageUpload, multipart, solidPng } from "./helpers.js";

describe("with the real model", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({}, { logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  const predict = (upload: { payload: Buffer; headers: Record<string, string> }) =>
    app.inject({ method: "POST", url: "/predict", ...upload });

  it("reports a loaded model on /health", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      service: "CropGuard AI Engine",
      version: "0.1.0",
      status: "ok",
      model_loaded: true,
      class_count: 38,
      detail: null,
    });
  });

  it("serves the Hebrew test page at /", async () => {
    const response = await app.inject({ method: "GET", url: "/" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain('dir="rtl"');
    expect(response.body).toContain("CropGuard");
    expect(response.body).toContain('fetch("/predict"');
  });

  it("keeps the test page out of the API docs", async () => {
    const paths = Object.keys((await app.inject({ method: "GET", url: "/docs/json" })).json().paths);
    expect(paths.sort()).toEqual(["/health", "/predict"]);
  });

  it("publishes OpenAPI docs titled CropGuard AI Engine", async () => {
    const response = await app.inject({ method: "GET", url: "/docs/json" });
    expect(response.statusCode).toBe(200);
    expect(response.json().info.title).toBe("CropGuard AI Engine");
  });

  // ערכי הייחוס הופקו מהמודל המקורי ב-Keras 3.15 על אותן תמונות בדיוק
  it("matches the Keras reference on a solid green leaf colour", async () => {
    const response = await predict(imageUpload(await solidPng(224, 224, [40, 160, 40])));
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.model_label).toBe("Corn___Healthy");
    expect(body.confidence).toBeCloseTo(0.7618, 2);
    expect(body.is_healthy).toBe(true);
    expect(body.status).toBe("healthy");
  });

  it("matches the Keras reference on a colour gradient", async () => {
    const response = await predict(imageUpload(await gradientPng()));
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.model_label).toBe("Corn___Common_rust");
    expect(body.disease).toBe("Corn Common rust");
    expect(body.confidence).toBeCloseTo(0.9821, 2);
    expect(body.is_healthy).toBe(false);
    expect(body.status).toBe("infected");
  });

  it("returns a clean, consistent JSON shape", async () => {
    const response = await predict(imageUpload(await gradientPng()));
    const body = response.json();
    expect(Object.keys(body).sort()).toEqual(
      [
        "confidence", "confidence_percent", "disease", "is_healthy", "model_label",
        "plant", "status", "top_predictions", "uncertain",
      ].sort(),
    );
    expect(body.confidence_percent).toBeCloseTo(body.confidence * 100, 1);
    expect(body.top_predictions).toHaveLength(3);
    expect(body.top_predictions[0].model_label).toBe(body.model_label);
    const confidences = body.top_predictions.map((p: { confidence: number }) => p.confidence);
    expect([...confidences].sort((a, b) => b - a)).toEqual(confidences);
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("returns the full 38-class distribution with top_k=38", async () => {
    const upload = imageUpload(await gradientPng());
    const response = await app.inject({ method: "POST", url: "/predict?top_k=38", ...upload });
    expect(response.statusCode).toBe(200);
    const scores = response.json().top_predictions as Array<{ confidence: number }>;
    expect(scores).toHaveLength(38);
    // הסכום קרוב ל-1 (עיגול ל-4 ספרות בכל ערך)
    expect(scores.reduce((sum, p) => sum + p.confidence, 0)).toBeCloseTo(1, 2);
  });

  it.each(["0", "39", "abc"])("rejects top_k=%s with 422", async (value) => {
    const upload = imageUpload(await gradientPng());
    const response = await app.inject({ method: "POST", url: `/predict?top_k=${value}`, ...upload });
    expect(response.statusCode).toBe(422);
  });

  it("is deterministic for the same image", async () => {
    const image = await gradientPng();
    const first = (await predict(imageUpload(image))).json();
    const second = (await predict(imageUpload(image))).json();
    expect(second).toEqual(first);
  });

  it("accepts JPEG, non-square, greyscale and transparent images", async () => {
    const jpeg = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#3c8c32" } }).jpeg().toBuffer();
    const grey = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#808080" } })
      .greyscale().png().toBuffer();
    const rgba = await sharp({ create: { width: 120, height: 200, channels: 4, background: { r: 30, g: 150, b: 40, alpha: 0.5 } } })
      .png().toBuffer();
    for (const [data, type] of [[jpeg, "image/jpeg"], [grey, "image/png"], [rgba, "image/png"]] as const) {
      const response = await predict(imageUpload(data, type));
      expect(response.statusCode, type).toBe(200);
    }
  });

  it("accepts application/octet-stream uploads", async () => {
    const response = await predict(imageUpload(await solidPng(64, 64, [40, 160, 40]), "application/octet-stream", "leaf"));
    expect(response.statusCode).toBe(200);
  });

  it("echoes a client-supplied X-Request-ID", async () => {
    const upload = imageUpload(await solidPng(32, 32, [40, 160, 40]));
    const response = await app.inject({
      method: "POST", url: "/predict", payload: upload.payload,
      headers: { ...upload.headers, "x-request-id": "my-trace-123" },
    });
    expect(response.headers["x-request-id"]).toBe("my-trace-123");
  });

  it("rejects a non-image content type with 415", async () => {
    const response = await predict(imageUpload(Buffer.from("hello"), "text/plain", "notes.txt"));
    expect(response.statusCode).toBe(415);
    expect(response.json().error).toBe("unsupported_media_type");
  });

  it("rejects a corrupt image with 400", async () => {
    const response = await predict(imageUpload(Buffer.from("not really a png")));
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "bad_request", detail: "The uploaded file is not a readable image." });
  });

  it("rejects an empty upload with 400", async () => {
    const response = await predict(imageUpload(Buffer.alloc(0)));
    expect(response.statusCode).toBe(400);
  });

  it("rejects a request without a file with 422", async () => {
    const response = await predict(multipart([{ field: "note", data: "no file here" }]));
    expect(response.statusCode).toBe(422);
    expect(response.json().error).toBe("validation_error");
  });

  it("rejects a file in the wrong field with 422", async () => {
    const response = await predict(
      multipart([{ field: "photo", filename: "leaf.png", contentType: "image/png", data: await solidPng(8, 8, [0, 0, 0]) }]),
    );
    expect(response.statusCode).toBe(422);
  });

  it("rejects a non-multipart request with 415", async () => {
    const response = await app.inject({ method: "POST", url: "/predict", payload: { image: "x" } });
    expect(response.statusCode).toBe(415);
    expect(response.json().error).toBe("unsupported_media_type");
  });

  it("returns the error format for unknown routes", async () => {
    const response = await app.inject({ method: "GET", url: "/nope" });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("not_found");
  });
});

describe("limits and failures", () => {
  it("rejects an oversized upload with 413", async () => {
    const app = await buildApp({ maxUploadBytes: 100 }, { logger: false });
    try {
      const response = await app.inject({ method: "POST", url: "/predict", ...imageUpload(await solidPng(64, 64, [1, 2, 3])) });
      expect(response.statusCode).toBe(413);
      expect(response.json().error).toBe("payload_too_large");
    } finally {
      await app.close();
    }
  });

  it("stays up but degraded when the model file is missing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cropguard-"));
    const app = await buildApp({ modelPath: path.join(dir, "missing.onnx") }, { logger: false });
    try {
      const health = (await app.inject({ method: "GET", url: "/health" })).json();
      expect(health.status).toBe("degraded");
      expect(health.model_loaded).toBe(false);
      expect(health.detail).toContain("Model file not found");

      const response = await app.inject({ method: "POST", url: "/predict", ...imageUpload(await solidPng(8, 8, [0, 0, 0])) });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe("model_unavailable");
    } finally {
      await app.close();
    }
  });

  it("refuses to start with an invalid labels file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cropguard-"));
    const labelsPath = path.join(dir, "labels.txt");
    await writeFile(labelsPath, "Apple___Healthy\n");
    await expect(buildApp({ labelsPath }, { logger: false })).rejects.toThrow("Expected 38 labels");
  });
});

describe("image preprocessing", () => {
  it("produces a 224x224x3 float tensor with raw 0..255 values", async () => {
    const pixels = await prepareImage(await solidPng(300, 120, [255, 0, 10]));
    expect(pixels).toBeInstanceOf(Float32Array);
    expect(pixels.length).toBe(224 * 224 * 3);
    expect(pixels.reduce((max, value) => Math.max(max, value), 0)).toBe(255);
    expect(Array.from(pixels.slice(0, 3))).toEqual([255, 0, 10]);
  });
});
