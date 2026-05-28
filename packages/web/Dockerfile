FROM node:24-slim AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/web/ packages/web/
RUN pnpm --filter @opusheart/shared build
RUN pnpm --filter @opusheart/web build

FROM node:24-slim
RUN groupadd -g 1001 appgroup && useradd -u 1001 -g appgroup -s /bin/sh -m appuser
WORKDIR /app
COPY --from=build /app/packages/web/.output ./
USER appuser
ENV NODE_ENV=production
ENV NITRO_PORT=3022
ENV NITRO_HOST=0.0.0.0
EXPOSE 3022
CMD ["node", "server/index.mjs"]
