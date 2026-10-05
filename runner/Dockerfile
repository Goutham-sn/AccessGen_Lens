# Build context is the repo root (see docker-compose.yml), so the extension's
# profile code can be bundled into the runner.
FROM mcr.microsoft.com/playwright:v1.63.0-jammy

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NODE_ENV=production

WORKDIR /app/runner

COPY runner/package.json ./
RUN npm install --omit=dev

COPY extension/package.json /app/extension/package.json
COPY extension/profiles /app/extension/profiles
# The one capabilities file shared with the backend (see checks/index.js).
COPY backend/src/config/runnerCapabilities.js /app/backend/src/config/runnerCapabilities.js
COPY runner/ ./
RUN node scripts/build-profiles.js && chown -R pwuser:pwuser /app

USER pwuser

CMD ["node", "src/worker.js"]
