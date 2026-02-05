export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Trading Screener API",
    version: "0.1.0",
    description:
      "HTTP API for quotes and simple screening. Error responses are sanitized and include a stable error code.",
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: "object",
        additionalProperties: false,
        properties: {
          error: { type: "string" },
          code: { type: "string" },
        },
        required: ["error", "code"],
      },
      StatusResponse: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          version: { type: "string" },
          status: { type: "string" },
        },
        required: ["name", "version", "status"],
      },
      QuoteBatchRequest: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbols: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100 },
        },
        required: ["symbols"],
      },
      ScanRequest: {
        type: "object",
        additionalProperties: false,
        properties: {
          minPrice: { type: "number", minimum: 0 },
          maxPrice: { type: "number", minimum: 0 },
          minVolume: { type: "number", minimum: 0 },
          minRsi: { type: "number", minimum: 0, maximum: 100 },
          maxRsi: { type: "number", minimum: 0, maximum: 100 },
          aboveSma20: { type: "boolean" },
          aboveSma50: { type: "boolean" },
          symbols: { type: "array", items: { type: "string" }, maxItems: 100 },
        },
      },
      SignalsRequest: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbols: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100 },
        },
        required: ["symbols"],
      },
      QuoteLike: {
        type: "object",
        description: "Provider quote payload (shape may vary by provider/version).",
        additionalProperties: true,
      },
      ChartLike: {
        type: "object",
        description: "Provider chart payload (shape may vary by provider/version).",
        additionalProperties: true,
      },
      ScanResult: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: { type: "string" },
          price: { type: "number" },
          volume: { type: "number" },
          change: { type: "number" },
          changePercent: { type: "number" },
          rsi: { type: "number" },
          aboveSma20: { type: "boolean" },
          aboveSma50: { type: "boolean" },
        },
        required: ["symbol", "price", "volume", "change", "changePercent"],
      },
      Signal: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: { type: "string" },
          type: { type: "string" },
          direction: { type: "string", enum: ["bullish", "bearish", "neutral"] },
          strength: { type: "number" },
          timestamp: { type: "string" },
          description: { type: "string" },
        },
        required: ["symbol", "type", "direction", "strength", "timestamp", "description"],
      },
    },
  },
  paths: {
    "/": {
      get: {
        summary: "Service status",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/StatusResponse" } },
            },
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
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QuoteLike" },
                examples: {
                  yahoo: {
                    value: { symbol: "AAPL", regularMarketPrice: 123.45, regularMarketVolume: 100 },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                examples: {
                  invalidSymbol: { value: { error: "Invalid request", code: "VALIDATION_ERROR" } },
                },
              },
            },
          },
          "502": {
            description: "Upstream provider error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "504": {
            description: "Timeout",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "500": {
            description: "Internal error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
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
              schema: { $ref: "#/components/schemas/QuoteBatchRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Quotes",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/QuoteLike" } },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "502": {
            description: "Upstream provider error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "504": {
            description: "Timeout",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "500": {
            description: "Internal error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
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
            content: { "application/json": { schema: { $ref: "#/components/schemas/ChartLike" } } },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "502": {
            description: "Upstream provider error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "504": {
            description: "Timeout",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "500": {
            description: "Internal error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
    },
    "/api/screener/scan": {
      post: {
        summary: "Scan symbols by criteria",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ScanRequest" } } },
        },
        responses: {
          "200": {
            description: "Results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    results: { type: "array", items: { $ref: "#/components/schemas/ScanResult" } },
                  },
                  required: ["results"],
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
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
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    movers: { type: "array", items: { $ref: "#/components/schemas/ScanResult" } },
                  },
                  required: ["movers"],
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
    },
    "/api/screener/signals": {
      post: {
        summary: "Get signals for watchlist",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/SignalsRequest" } },
          },
        },
        responses: {
          "200": {
            description: "Signals",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    signals: { type: "array", items: { $ref: "#/components/schemas/Signal" } },
                  },
                  required: ["signals"],
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
            },
          },
        },
      },
    },
  },
} as const;
