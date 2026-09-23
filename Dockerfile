# Railway build. The Playwright base image ships Node plus a headless Chromium,
# which server/nbcrna-directory.js uses to run the NBCRNA directory search
# (the by-number lookup doesn't work for CRNAs certified in recent years).
# Keep the tag in step with the "playwright" version in package.json.
FROM mcr.microsoft.com/playwright:v1.56.0-noble

ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "server/index.js"]
