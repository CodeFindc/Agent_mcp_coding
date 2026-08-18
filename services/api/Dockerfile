FROM golang:1.24-bookworm AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /out/api ./cmd/api

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out/api /app/api
ENV HTTP_ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["/app/api"]
