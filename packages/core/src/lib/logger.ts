import pino from "pino";

const level = process.env.LOG_LEVEL || "info";

export const logger = pino({
  level,
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino/file",
          options: { destination: 1 }, // stdout
        }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: "trading-mcp",
  },
});

// Create child loggers for specific domains
export const createLogger = (module: string) => logger.child({ module });

// Pre-configured loggers for common modules
export const providerLogger = createLogger("providers");

export const apiLogger = createLogger("api");

export const mcpLogger = createLogger("mcp");
