package main

import (
	"sync"
	"time"
)

// rateLimiter is a fixed-window per-IP limiter: at most `limit` requests are
// served for a given address within one `window`.
type rateLimiter struct {
	mu      sync.Mutex
	hits    map[string][]time.Time
	limit   int
	window  time.Duration
	lastGC  time.Time
	gcEvery time.Duration
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		hits:    make(map[string][]time.Time),
		limit:   limit,
		window:  window,
		lastGC:  time.Now(),
		gcEvery: 5 * time.Minute,
	}
}

func (r *rateLimiter) allow(key string) bool {
	now := time.Now()
	cutoff := now.Add(-r.window)

	r.mu.Lock()
	defer r.mu.Unlock()

	if now.Sub(r.lastGC) > r.gcEvery {
		r.collect(cutoff)
		r.lastGC = now
	}

	recent := r.hits[key][:0]
	for _, hit := range r.hits[key] {
		if hit.After(cutoff) {
			recent = append(recent, hit)
		}
	}

	if len(recent) >= r.limit {
		r.hits[key] = recent
		return false
	}

	r.hits[key] = append(recent, now)
	return true
}

func (r *rateLimiter) collect(cutoff time.Time) {
	for key, hits := range r.hits {
		kept := hits[:0]
		for _, hit := range hits {
			if hit.After(cutoff) {
				kept = append(kept, hit)
			}
		}
		if len(kept) == 0 {
			delete(r.hits, key)
			continue
		}
		r.hits[key] = kept
	}
}
