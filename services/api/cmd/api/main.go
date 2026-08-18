package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/coding-agent-platform/api/internal/admin"
	"github.com/coding-agent-platform/api/internal/auth"
	"github.com/coding-agent-platform/api/internal/chat"
	"github.com/coding-agent-platform/api/internal/config"
	"github.com/coding-agent-platform/api/internal/db"
	"github.com/coding-agent-platform/api/internal/httpapi"
	"github.com/coding-agent-platform/api/internal/projects"
	"github.com/coding-agent-platform/api/internal/runtime"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	if abs, err := filepath.Abs(cfg.DataRoot); err == nil {
		cfg.DataRoot = abs
	}
	if err := os.MkdirAll(cfg.DataRoot, 0o755); err != nil {
		log.Fatalf("data root: %v", err)
	}

	gdb, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}

	authSvc, err := auth.NewService(gdb, cfg)
	if err != nil {
		log.Fatalf("auth: %v", err)
	}
	projectsSvc := projects.NewService(gdb, cfg.DataRoot)
	runtimeSvc, err := runtime.NewService(gdb, cfg, projectsSvc)
	if err != nil {
		log.Fatalf("runtime: %v", err)
	}
	projectsSvc.SetRuntimeCleaner(runtimeSvc)
	chatSvc := chat.NewService(gdb, cfg, projectsSvc, runtimeSvc)
	adminSvc := admin.NewService(gdb, cfg)

	handler := httpapi.New(cfg, authSvc, projectsSvc, runtimeSvc, chatSvc, adminSvc)
	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := runtimeSvc.ReapIdle(ctx); err != nil {
					log.Printf("reap idle: %v", err)
				}
			}
		}
	}()

	go func() {
		log.Printf("API listening on %s", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
	log.Printf("shutdown complete")
}
