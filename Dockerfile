FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci && npm cache clean --force

FROM base AS dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS build
COPY . .
RUN npm run build

FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
EXPOSE 3000
CMD ["node", "dist/index.js"]
