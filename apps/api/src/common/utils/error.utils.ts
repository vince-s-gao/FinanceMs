import { HttpException } from "@nestjs/common";

type HttpErrorResponse = {
  message?: string | string[];
};

type NestedErrorResponse = {
  response?: {
    message?: string | string[];
  };
  message?: string;
};

export function resolveErrorMessage(
  error: unknown,
  fallback = "请求失败",
): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === "string" && response) return response;
    const payload = response as HttpErrorResponse;
    if (Array.isArray(payload?.message)) return payload.message.join("; ");
    if (typeof payload?.message === "string" && payload.message) {
      return payload.message;
    }
  }

  if (error && typeof error === "object") {
    const payload = error as NestedErrorResponse;
    if (Array.isArray(payload.response?.message)) {
      return payload.response.message.join("; ");
    }
    if (
      typeof payload.response?.message === "string" &&
      payload.response.message
    ) {
      return payload.response.message;
    }
    if (typeof payload.message === "string" && payload.message) {
      return payload.message;
    }
  }

  return fallback;
}
