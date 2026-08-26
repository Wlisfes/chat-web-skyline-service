FROM node:22-alpine AS dependencies
WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY package.json yarn.lock ./
RUN --mount=type=cache,id=skyline-yarn-cache,target=/usr/local/share/.cache/yarn,sharing=locked \
    yarn install --frozen-lockfile --non-interactive --ignore-scripts --network-timeout 120000

FROM dependencies AS builder
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN yarn build

FROM dependencies AS production-dependencies
RUN --mount=type=cache,id=skyline-yarn-cache,target=/usr/local/share/.cache/yarn,sharing=locked \
    rm -rf node_modules && \
    yarn install --frozen-lockfile --production=true --prefer-offline --non-interactive --ignore-scripts --network-timeout 120000

FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production \
    PORT=4020

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 4020

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=4 \
    CMD node -e "require('http').get('http://127.0.0.1:4020/health/live', response => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]
