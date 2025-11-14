# syntax=docker/dockerfile:1

############################
# Builder stage
############################
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies (including dev) to build TypeScript
COPY package*.json tsconfig.json ./
RUN npm install

# Copy source and build
COPY src ./src
RUN npm run build

############################
# Runtime stage
############################
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled JS from builder
COPY --from=builder /usr/src/app/dist ./dist

# Run as non-root for better security
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs
USER nodeuser

EXPOSE 3000

CMD ["node", "dist/server.js"]
