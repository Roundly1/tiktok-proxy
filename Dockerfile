FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV PORT=3000

# Hammasi bir marta o'rnatiladi
RUN apt-get update && apt-get install -y \
    curl xvfb x11vnc novnc websockify \
    chromium fonts-liberation fonts-noto-color-emoji \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install
COPY server.js ./

CMD ["node", "server.js"]
