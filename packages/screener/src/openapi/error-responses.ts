import { z } from "@hono/zod-openapi";

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
});

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: ErrorResponseSchema,
    },
  },
});

export const publicErrorResponses = {
  400: errorResponse("Bad Request"),
  401: errorResponse("Unauthorized"),
  403: errorResponse("Forbidden"),
  404: errorResponse("Not Found"),
  409: errorResponse("Conflict"),
  422: errorResponse("Unprocessable Entity"),
  429: errorResponse("Too Many Requests"),
  500: errorResponse("Internal Server Error"),
  502: errorResponse("Bad Gateway"),
  503: errorResponse("Service Unavailable"),
  504: errorResponse("Gateway Timeout"),
} as const;
