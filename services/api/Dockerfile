ARG APT_MIRROR=mirrors.aliyun.com
ARG GOPROXY=https://goproxy.cn,direct

FROM golang:1.24-bookworm AS build
ARG APT_MIRROR
ARG GOPROXY
WORKDIR /src

RUN if [ -n "$APT_MIRROR" ]; then \
      sed -i "s@deb.debian.org@${APT_MIRROR}@g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
      sed -i "s@deb.debian.org@${APT_MIRROR}@g" /etc/apt/sources.list 2>/dev/null || true; \
    fi
ENV GOPROXY=$GOPROXY

COPY go.mod go.sum ./
COPY . .
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api

FROM debian:bookworm-slim
ARG APT_MIRROR
RUN if [ -n "$APT_MIRROR" ]; then \
      sed -i "s@deb.debian.org@${APT_MIRROR}@g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
      sed -i "s@deb.debian.org@${APT_MIRROR}@g" /etc/apt/sources.list 2>/dev/null || true; \
    fi && \
    apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out/api /app/api
ENV HTTP_ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["/app/api"]
