# Ảnh duy nhất `eurohouse/app:<tag>` chứa api, admin, npp, web và bản web (PWA) của app di động.
# Dựng lại từ lịch sử ảnh 2026-11-06-a5f768cwt đang chạy trên MINI 02.
# Chạy lệnh từ thư mục gốc repo:
#   docker build -f deploy/mini02/Dockerfile -t eurohouse/app:<tag> .
# Địa chỉ API nhúng vào bản web/app lúc build (đổi bằng --build-arg PUBLIC_API_URL=...).
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
ARG PUBLIC_API_URL=https://api.nhomeurohouse.com/api
ENV CI=true HUSKY=0 NEXT_TELEMETRY_DISABLED=1 PNPM_HOME=/pnpm \
    PATH=/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    NEXT_PUBLIC_API_URL=${PUBLIC_API_URL} EXPO_PUBLIC_API_URL=${PUBLIC_API_URL} \
    NODE_OPTIONS=--max-old-space-size=3072
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@10.13.1 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @eurohouse/api build
RUN pnpm --filter @eurohouse/admin build
RUN pnpm --filter @eurohouse/npp build
RUN pnpm --filter @eurohouse/web build
RUN cd apps/mobile && pnpm exec expo export --platform web

FROM ${NODE_IMAGE}
ENV NODE_ENV=production HOME=/tmp STORAGE_PROVIDER=local CI=true HUSKY=0 NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm PATH=/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@10.13.1 --activate
COPY --from=build /app /app
WORKDIR /app
RUN mkdir -p /app/apps/api/public/uploads /app/apps/api/uploads \
 && chown -R 2000:2000 /app/apps/api/public/uploads /app/apps/api/uploads \
      /app/apps/admin/.next /app/apps/npp/.next /app/apps/web/.next
USER 2000:2000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node"]
