FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Install API dependencies
COPY api/package*.json ./api/
RUN cd api && npm ci --production

# Copy API source
COPY api/ ./api/

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

# Run as non-root for security
RUN addgroup -S app && adduser -S app -G app
RUN chown -R app:app /app
USER app

WORKDIR /app/api

EXPOSE 3000

CMD ["node", "server.js"]
