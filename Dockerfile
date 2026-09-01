FROM node:24-alpine AS builder

# Install pnpm without Corepack or npm
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME/bin:$PATH
ENV ENV=/etc/profile.d/pnpm.sh
RUN touch "$ENV" && wget -qO- https://get.pnpm.io/install.sh | env PNPM_VERSION=12.2.1 SHELL=/bin/sh ENV="$ENV" sh -

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/mcp/package.json ./packages/mcp/
COPY packages/screener/package.json ./packages/screener/

# Install dependencies
# Native optional addons are not needed by the API runtime, and pnpm's
# standalone Alpine build cannot compile them from the bundled node-gyp.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build all packages
RUN ./node_modules/.bin/turbo run build

# Production image
FROM node:24-alpine

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME/bin:$PATH
ENV ENV=/etc/profile.d/pnpm.sh
RUN touch "$ENV" && wget -qO- https://get.pnpm.io/install.sh | env PNPM_VERSION=12.2.1 SHELL=/bin/sh ENV="$ENV" sh -

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/screener/package.json ./packages/screener/
COPY --from=builder /app/packages/screener/dist ./packages/screener/dist

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "packages/screener/dist/index.js"]
