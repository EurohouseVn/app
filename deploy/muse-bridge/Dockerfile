# Cầu nối trình duyệt tới muse.ai (tài khoản web). Chạy Chromium có giao diện trên màn hình ảo,
# giữ đăng nhập trong volume /data. noVNC (cổng 6080) chỉ để đăng nhập/bảo trì, bind 127.0.0.1.
FROM node:22-bookworm
ENV DEBIAN_FRONTEND=noninteractive PLAYWRIGHT_BROWSERS_PATH=/ms-playwright DISPLAY=:99
RUN apt-get update \
 && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify fonts-noto-color-emoji fonts-liberation tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*
COPY server.mjs entry.sh ./
RUN chmod +x entry.sh && mkdir -p /data
VOLUME /data
EXPOSE 6080 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/entry.sh"]
