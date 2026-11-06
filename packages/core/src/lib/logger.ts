import pino from "pino";

const level = process.env.LOG_LEVEL === "" ? "info" : (process.env.LOG_LEVEL ?? "info");

export const logger = pino(
  {
    level,
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      service: "trading-mcp",
    },
  },
  pino.destination(2),
);

export const createLogger = (module: string) => logger.child({ module });

export const providerLogger = createLogger("providers");

export const apiLogger = createLogger("api");

export const mcpLogger = createLogger("mcp");
