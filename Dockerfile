FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG BETTER_AUTH_URL=http://localhost:3000
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Used by the `migrate` compose service — has tsx + source + node_modules.
FROM builder AS migrator
CMD ["pnpm", "db:migrate"]

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
