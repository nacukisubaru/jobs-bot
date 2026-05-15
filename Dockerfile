FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    gnupg2 ca-certificates wget \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
    libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
    libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 \
    fonts-liberation xdg-utils xvfb \
    && rm -rf /var/lib/apt/lists/*

RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && dpkg -i google-chrome-stable_current_amd64.deb; apt-get -fy install \
    && rm -rf google-chrome-stable_current_amd64.deb

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x /app/scripts/entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["sh", "/app/scripts/entrypoint.sh"]