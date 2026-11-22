/**
 * טיפול אחיד בשגיאות: כל שגיאה יוצאת מהשרת בפורמט {"error": "<קוד>", "detail": "<הסבר>"}.
 */

import type { ServerErrorCode, ServerErrorResponse } from "@cropguard/shared-types";
import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";

/** שגיאה עם סטטוס HTTP וקוד קבוע, שנזרקת מתוך ה-routes */
export class HttpError extends Error {
  override name = "HttpError";
  constructor(
    readonly status: number,
    readonly code: ServerErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, "bad_request", message);
export const validationError = (message: string) => new HttpError(422, "validation_error", message);
export const unauthorized = (message = "Authentication required.") => new HttpError(401, "unauthorized", message);
export const forbidden = (message = "You do not have permission to do this.") => new HttpError(403, "forbidden", message);
export const notFound = (message: string) => new HttpError(404, "not_found", message);
export const conflict = (message: string) => new HttpError(409, "conflict", message);

export function errorBody(code: ServerErrorCode, detail: string): ServerErrorResponse {
  return { error: code, detail };
}

/** הופך שגיאות zod להודעה קצרה וקריאה: "latitude: Too big..." */
function describeZodError(error: ZodError): string {
  return error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
    .join("; ");
}

/** ממפה כל שגיאה לסטטוס, קוד והודעה ללקוח */
function classify(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof ZodError) return validationError(describeZodError(error));

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") return new HttpError(413, "payload_too_large", "Uploaded image is too large.");
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return validationError('Send exactly one image, in a form field named "image".');
    }
    return badRequest(error.message);
  }

  // שגיאות של body-parser (JSON פגום, גוף גדול מדי)
  const type = (error as { type?: string }).type;
  if (type === "entity.parse.failed") return badRequest("Request body is not valid JSON.");
  if (type === "entity.too.large") return new HttpError(413, "payload_too_large", "Request body is too large.");

  return new HttpError(500, "internal_error", "Internal server error.");
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const httpError = classify(error);
  if (httpError.status >= 500) {
    request.log?.error({ err: error }, "Request failed");
  } else {
    request.log?.warn({ status: httpError.status, detail: httpError.message }, "Request rejected");
  }
  response.status(httpError.status).json(errorBody(httpError.code, httpError.message));
};

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json(errorBody("not_found", `Route ${request.method} ${request.path} not found.`));
};
