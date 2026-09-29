// Command gateway is the single public entry point of the GitOp platform.
//
// It terminates client traffic, applies per-IP rate limiting to authentication
// endpoints, records every proxied request in PostgreSQL and forwards the
// request to the Rust core API.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

type config struct {
	port        string
	upstream    *url.URL
	databaseURL string
	allowOrigin string
}

func loadConfig() (config, error) {
	upstreamRaw := envOr("API_UPSTREAM", "http://localhost:8080")
	upstream, err := url.Parse(upstreamRaw)
	if err != nil {
		return config{}, err
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return config{}, errors.New("DATABASE_URL must be set (see .env.example)")
	}

	return config{
		port:        envOr("GATEWAY_PORT", "8081"),
		upstream:    upstream,
		databaseURL: databaseURL,
		allowOrigin: envOr("GATEWAY_ALLOW_ORIGIN", "*"),
	}, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type gateway struct {
	cfg     config
	proxy   *httputil.ReverseProxy
	limiter *rateLimiter
	audit   *auditLog
}

func (g *gateway) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	started := time.Now()
	ip := clientIP(r)

	g.applyCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if isAuthPath(r.URL.Path) && !g.limiter.allow(ip) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{
			"error": "Too many requests from this address. Slow down and retry shortly",
		})
		g.audit.record(r, http.StatusTooManyRequests, time.Since(started), ip)
		return
	}

	recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
	r.Header.Set("X-Forwarded-For", ip)
	r.Header.Set("X-Gateway", "gitop-gateway")
	g.proxy.ServeHTTP(recorder, r)

	g.audit.record(r, recorder.status, time.Since(started), ip)
}

func (g *gateway) applyCORS(w http.ResponseWriter, r *http.Request) {
	origin := g.cfg.allowOrigin
	if origin == "*" && r.Header.Get("Origin") != "" {
		origin = r.Header.Get("Origin")
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
	w.Header().Set("Vary", "Origin")
}

func isAuthPath(path string) bool {
	return strings.HasPrefix(path, "/api/auth/")
}

func clientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		return strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	host, _, found := strings.Cut(r.RemoteAddr, ":")
	if !found {
		return r.RemoteAddr
	}
	return host
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func (g *gateway) health(w http.ResponseWriter, r *http.Request) {
	upstreamStatus := "down"
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, g.cfg.upstream.String()+"/api/health", nil)
	if err == nil {
		if resp, err := http.DefaultClient.Do(req); err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				upstreamStatus = "healthy"
			}
		}
	}

	status := http.StatusOK
	if upstreamStatus != "healthy" {
		status = http.StatusServiceUnavailable
	}

	writeJSON(w, status, map[string]any{
		"service":  "gitop-gateway",
		"runtime":  "go",
		"upstream": upstreamStatus,
		"database": g.audit.healthy(r.Context()),
	})
}

func (g *gateway) traffic(w http.ResponseWriter, r *http.Request) {
	summary, err := g.audit.summary(r.Context())
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Traffic stats unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("gitop-gateway: %v", err)
	}

	audit, err := newAuditLog(cfg.databaseURL)
	if err != nil {
		log.Fatalf("gitop-gateway: database: %v", err)
	}
	defer audit.close()

	g := &gateway{
		cfg:     cfg,
		proxy:   httputil.NewSingleHostReverseProxy(cfg.upstream),
		limiter: newRateLimiter(30, time.Minute),
		audit:   audit,
	}

	g.proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
		log.Printf("upstream error: %v", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": "The core API is unavailable. Try again in a moment",
		})
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/gw/health", g.health)
	mux.HandleFunc("/gw/traffic", g.traffic)
	mux.Handle("/api/", g)

	server := &http.Server{
		Addr:              ":" + cfg.port,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("gitop-gateway listening on :%s -> %s", cfg.port, cfg.upstream)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("gitop-gateway: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}
