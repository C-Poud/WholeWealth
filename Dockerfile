# ---- build stage -----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
  && npm prune --omit=dev

# ---- runtime stage ---------------------------------------------------------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# migrations run automatically at server boot (NODE_ENV=production)
COPY --from=build /app/server/db ./server/db

EXPOSE 3000
CMD ["node", "dist/boot.js"]
