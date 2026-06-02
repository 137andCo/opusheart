FROM node:24-slim AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/builder/package.json packages/builder/
COPY packages/dashboard/package.json packages/dashboard/
RUN pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/builder/ packages/builder/
COPY packages/dashboard/ packages/dashboard/
RUN pnpm --filter @opusheart/shared build
RUN pnpm --filter @opusheart/builder build
RUN pnpm --filter @opusheart/dashboard build

# Unprivileged nginx — runs as non-root (uid 101) by default, listens on 3021.
FROM nginxinc/nginx-unprivileged:stable
COPY --from=build /app/packages/dashboard/.output/public /usr/share/nginx/html
COPY packages/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3021
