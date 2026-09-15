FROM node:20-bookworm-slim

ENV TZ=Asia/Jakarta \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Dependensi Node + browser Chromium Playwright (termasuk lib OS) + CLI OpenCode.
# Urutan: install deps dulu agar layer npm ter-cache saat kode berubah.
COPY package.json package-lock.json* ./
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && npm ci --omit=dev \
 && npx playwright install --with-deps chromium \
 && npm cache clean --force \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://opencode.ai/install | bash \
 && mv /root/.opencode/bin/opencode /usr/local/bin/opencode \
 && opencode --version

COPY . .

# Data run (screenshot) hidup di volume, bukan di lapisan image.
RUN useradd -m -u 1001 -d /home/runner runner \
 && mkdir -p storage/runs \
 && chown -R 1001:1001 /app
USER 1001

EXPOSE 5002
CMD ["node", "app.js"]
