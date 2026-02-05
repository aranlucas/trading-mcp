export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Trading Screener API",
    version: "0.1.0",
  },
  paths: {
    "/": {
      get: {
        summary: "Service status",
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/health": {
      get: {
        summary: "Provider health check",
        responses: {
          "200": {
            description: "Healthy/Degraded",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "503": {
            description: "Unhealthy",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/api/quotes/{symbol}": {
      get: {
        summary: "Get single quote (Yahoo)",
        parameters: [{ name: "symbol", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Quote",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "500": {
            description: "Upstream error",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/api/quotes/batch": {
      post: {
        summary: "Get multiple quotes (Yahoo)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { symbols: { type: "array", items: { type: "string" } } },
                required: ["symbols"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Quotes",
            content: {
              "application/json": { schema: { type: "array", items: { type: "object" } } },
            },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "500": {
            description: "Upstream error",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/api/quotes/{symbol}/bars": {
      get: {
        summary: "Get price bars (Yahoo)",
        parameters: [
          { name: "symbol", in: "path", required: true, schema: { type: "string" } },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 365 },
          },
        ],
        responses: {
          "200": {
            description: "Bars",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "500": {
            description: "Upstream error",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/api/screener/scan": {
      post: {
        summary: "Scan symbols by criteria",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": {
            description: "Results",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/api/screener/movers/{direction}": {
      get: {
        summary: "Get top movers",
        parameters: [
          {
            name: "direction",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["gainers", "losers"] },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          "200": {
            description: "Movers",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/api/screener/signals": {
      post: {
        summary: "Get signals for watchlist",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": {
            description: "Signals",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
  },
} as const;
