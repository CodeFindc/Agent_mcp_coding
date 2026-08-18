package models

import "time"

type UserRole string

const (
	RoleUser  UserRole = "user"
	RoleAdmin UserRole = "admin"
)

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	OIDCSub   string    `gorm:"size:255;uniqueIndex" json:"oidcSub"`
	Email     string    `gorm:"size:255;index" json:"email"`
	Name      string    `gorm:"size:255" json:"name"`
	Role      UserRole  `gorm:"size:32;not null;default:user" json:"role"`
	Disabled  bool      `gorm:"not null;default:false" json:"disabled"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Project struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"userId"`
	Name      string    `gorm:"size:128;not null" json:"name"`
	Slug      string    `gorm:"size:128;not null" json:"slug"`
	DiskPath  string    `gorm:"size:1024;not null" json:"diskPath"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type RuntimeStatus string

const (
	RuntimeStopped RuntimeStatus = "stopped"
	RuntimeStarting RuntimeStatus = "starting"
	RuntimeRunning RuntimeStatus = "running"
	RuntimeError   RuntimeStatus = "error"
)

// WorkspaceRuntime is one coding-tools container per (user, project).
// A user may run multiple projects in parallel.
type WorkspaceRuntime struct {
	ID            uint          `gorm:"primaryKey" json:"id"`
	UserID        uint          `gorm:"not null;uniqueIndex:idx_runtime_user_project,priority:1" json:"userId"`
	ProjectID     uint          `gorm:"not null;uniqueIndex:idx_runtime_user_project,priority:2;index" json:"projectId"`
	ContainerID   string        `gorm:"size:128" json:"containerId"`
	ContainerName string        `gorm:"size:128" json:"containerName"`
	Status        RuntimeStatus `gorm:"size:32;not null;default:stopped;index" json:"status"`
	MCPTokenEnc   string        `gorm:"type:text" json:"-"`
	LastError     string        `gorm:"type:text" json:"lastError"`
	LastActiveAt  *time.Time    `json:"lastActiveAt"`
	CreatedAt     time.Time     `json:"createdAt"`
	UpdatedAt     time.Time     `json:"updatedAt"`
}

type ChatThread struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"userId"`
	ProjectID uint      `gorm:"index;not null" json:"projectId"`
	Title     string    `gorm:"size:255;not null;default:New chat" json:"title"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type ChatMessage struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ThreadID      uint      `gorm:"index;not null" json:"threadId"`
	Role          string    `gorm:"size:32;not null" json:"role"`
	Content       string    `gorm:"type:text" json:"content"`
	ToolCallsJSON string    `gorm:"type:text" json:"toolCallsJson,omitempty"`
	ToolCallID    string    `gorm:"size:128" json:"toolCallId,omitempty"`
	Name          string    `gorm:"size:160" json:"name,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
}

type ModelProvider struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"size:128;not null" json:"name"`
	BaseURL      string    `gorm:"size:512;not null" json:"baseUrl"`
	APIKeyEnc    string    `gorm:"type:text" json:"-"`
	DefaultModel string    `gorm:"size:128;not null" json:"defaultModel"`
	Enabled      bool      `gorm:"not null;default:true" json:"enabled"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Session struct {
	ID        string    `gorm:"primaryKey;size:64" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"userId"`
	ExpiresAt time.Time `gorm:"index" json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}
