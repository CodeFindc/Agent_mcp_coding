package db

import (
	"fmt"
	"strings"
	"time"

	"github.com/coding-agent-platform/api/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(databaseURL string) (*gorm.DB, error) {
	var dialector gorm.Dialector
	if strings.HasPrefix(databaseURL, "postgres://") || strings.HasPrefix(databaseURL, "postgresql://") {
		dialector = postgres.Open(databaseURL)
	} else {
		dsn := strings.TrimPrefix(databaseURL, "file:")
		// pure-Go SQLite (no CGO)
		dialector = sqlite.Open(dsn)
	}
	gdb, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, err
	}
	sqlDB, err := gdb.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err = gdb.AutoMigrate(
		&models.User{},
		&models.Project{},
		&models.WorkspaceRuntime{},
		&models.ChatThread{},
		&models.ChatMessage{},
		&models.ModelProvider{},
		&models.Session{},
	); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return gdb, nil
}
