FROM node:24-slim AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/ai/package.json packages/ai/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/ai/ packages/ai/
COPY packages/server/ packages/server/
RUN pnpm --filter @opusheart/shared build
RUN pnpm --filter @opusheart/ai build
RUN pnpm --filter @opusheart/server build

FROM node:24-slim
RUN groupadd -g 1001 appgroup && useradd -u 1001 -g appgroup -s /bin/sh -m appuser
WORKDIR /app
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/packages/server/package.json ./
COPY --from=build /app/packages/shared/dist ./node_modules/@opusheart/shared/dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@opusheart/shared/
COPY --from=build /app/packages/ai/dist ./node_modules/@opusheart/ai/dist
COPY --from=build /app/packages/ai/package.json ./node_modules/@opusheart/ai/
COPY --from=build /app/node_modules ./node_modules
USER appuser
ENV NODE_ENV=production
EXPOSE 3020
CMD ["node", "dist/index.js"]
