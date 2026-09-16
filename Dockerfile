FROM node:20-bookworm-slim

ENV TZ=Asia/Jakarta \
    DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    XDG_STATE_HOME=/home/runner/.local/state \
    XDG_CACHE_HOME=/home/runner/.cache \
    XDG_CONFIG_HOME=/home/runner/.config

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
# Browser Playwright di /ms-playwright (shared path) agar terbaca USER runner;
# install sebagai root menaruhnya di /root/.cache yang tak terlihat runner (penyebab FAILED 0 steps).
# Direktori home runner di-pre-create milik runner agar bind-mount compose
# (~/.config/opencode, ~/.local/share/opencode) tidak menciptakan parent milik
# root — CLI OpenCode (Bun) wajib bisa mkdir $HOME/.local/state (penyebab EACCES).
RUN useradd -m -u 1001 -d /home/runner runner \
  && mkdir -p storage/runs /ms-playwright \
    /home/runner/.local/state /home/runner/.local/share \
    /home/runner/.config /home/runner/.cache \
  && chown -R 1001:1001 /ms-playwright /app /home/runner
USER 1001

EXPOSE 5002
CMD ["node", "app.js"]
