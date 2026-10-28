FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.container.json ./
COPY src ./src
COPY scripts ./scripts
RUN npx tsc -p tsconfig.container.json

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/build ./build
COPY --chown=node:node public ./build/public
COPY --chown=node:node migrations ./build/migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/db').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "build/src/server.js"]
