package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"time"

	_ "github.com/lib/pq"
)

type auditLog struct {
	db     *sql.DB
	events chan gatewayRequest
}

type gatewayRequest struct {
	method     string
	path       string
	status     int
	durationMs int
	ip         string
}

// TrafficSummary is returned by /gw/traffic and powers the platform status card.
type TrafficSummary struct {
	LastHour       int     `json:"lastHour"`
	Errors         int     `json:"errors"`
	AverageLatency float64 `json:"averageLatencyMs"`
}

func newAuditLog(databaseURL string) (*auditLog, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(10)
	db.SetConnMaxIdleTime(time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	a := &auditLog{db: db, events: make(chan gatewayRequest, 512)}
	go a.drain()
	return a, nil
}

// record never blocks the request path: when the buffer is full the event is dropped.
func (a *auditLog) record(r *http.Request, status int, duration time.Duration, ip string) {
	event := gatewayRequest{
		method:     r.Method,
		path:       r.URL.Path,
		status:     status,
		durationMs: int(duration.Milliseconds()),
		ip:         ip,
	}

	select {
	case a.events <- event:
	default:
	}
}

func (a *auditLog) drain() {
	for event := range a.events {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		_, err := a.db.ExecContext(ctx,
			`INSERT INTO gateway_requests (method, path, status, duration_ms, ip_address)
			 VALUES ($1, $2, $3, $4, $5)`,
			event.method, event.path, event.status, event.durationMs, event.ip)
		cancel()
		if err != nil {
			log.Printf("audit insert failed: %v", err)
		}
	}
}

func (a *auditLog) healthy(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return a.db.PingContext(ctx) == nil
}

func (a *auditLog) summary(ctx context.Context) (TrafficSummary, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var summary TrafficSummary
	err := a.db.QueryRowContext(ctx,
		`SELECT COUNT(*),
		        COUNT(*) FILTER (WHERE status >= 400),
		        COALESCE(AVG(duration_ms), 0)
		 FROM gateway_requests
		 WHERE created_at > NOW() - interval '1 hour'`).
		Scan(&summary.LastHour, &summary.Errors, &summary.AverageLatency)

	return summary, err
}

func (a *auditLog) close() {
	close(a.events)
	_ = a.db.Close()
}
