FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY gateway/go.mod gateway/go.sum ./
RUN go mod download
COPY gateway/ ./
RUN CGO_ENABLED=0 go build -o /gitop-gateway .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /gitop-gateway /usr/local/bin/gitop-gateway
EXPOSE 8081
CMD ["gitop-gateway"]
