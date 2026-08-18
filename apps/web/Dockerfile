ARG APT_MIRROR=mirrors.aliyun.com
ARG NPM_REGISTRY=https://registry.npmmirror.com

FROM node:22-bookworm AS deps
ARG APT_MIRROR
ARG NPM_REGISTRY
WORKDIR /app

RUN if [ -n "$APT_MIRROR" ]; then \
      sed -i "s@deb.debian.org@${APT_MIRROR}@g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
      sed -i "s@deb.debian.org@${APT_MIRROR}@g" /etc/apt/sources.list 2>/dev/null || true; \
    fi && \
    if [ -n "$NPM_REGISTRY" ]; then \
      npm config set registry ${NPM_REGISTRY}; \
    fi

COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-bookworm AS build
ARG NPM_REGISTRY
WORKDIR /app
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry ${NPM_REGISTRY}; fi
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE=http://localhost:8080
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
