package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/coding-agent-platform/api/internal/config"
	"github.com/coding-agent-platform/api/internal/models"
	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
)

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
)

type Service struct {
	db       *gorm.DB
	cfg      config.Config
	provider *oidc.Provider
	oauth    oauth2.Config
	verifier *oidc.IDTokenVerifier
}

type SessionUser struct {
	User models.User
}

func NewService(db *gorm.DB, cfg config.Config) (*Service, error) {
	s := &Service{db: db, cfg: cfg}
	if strings.TrimSpace(cfg.OIDCIssuer) == "" {
		return s, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	provider, err := oidc.NewProvider(ctx, cfg.OIDCIssuer)
	if err != nil {
		return nil, fmt.Errorf("oidc provider: %w", err)
	}
	s.provider = provider
	s.verifier = provider.Verifier(&oidc.Config{ClientID: cfg.OIDCClientID})
	s.oauth = oauth2.Config{
		ClientID:     cfg.OIDCClientID,
		ClientSecret: cfg.OIDCClientSecret,
		Endpoint:     provider.Endpoint(),
		RedirectURL:  cfg.OIDCRedirectURL,
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}
	return s, nil
}

func (s *Service) OIDCEnabled() bool {
	return s.provider != nil
}

func (s *Service) BeginOIDC(w http.ResponseWriter, r *http.Request) (string, error) {
	if !s.OIDCEnabled() {
		return "", fmt.Errorf("oidc is not configured")
	}
	state, err := randomString(24)
	if err != nil {
		return "", err
	}
	verifier, err := randomString(32)
	if err != nil {
		return "", err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "cap_oidc_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.CookieSecure,
		MaxAge:   600,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "cap_oidc_verifier",
		Value:    verifier,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.CookieSecure,
		MaxAge:   600,
	})
	codeChallenge := pkceChallenge(verifier)
	authURL := s.oauth.AuthCodeURL(state,
		oauth2.SetAuthURLParam("code_challenge", codeChallenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
	)
	return authURL, nil
}

func (s *Service) CompleteOIDC(w http.ResponseWriter, r *http.Request) (*models.User, error) {
	if !s.OIDCEnabled() {
		return nil, fmt.Errorf("oidc is not configured")
	}
	stateCookie, err := r.Cookie("cap_oidc_state")
	if err != nil || stateCookie.Value == "" || stateCookie.Value != r.URL.Query().Get("state") {
		return nil, fmt.Errorf("invalid oauth state")
	}
	verifierCookie, err := r.Cookie("cap_oidc_verifier")
	if err != nil || verifierCookie.Value == "" {
		return nil, fmt.Errorf("missing pkce verifier")
	}
	ctx := r.Context()
	token, err := s.oauth.Exchange(ctx, r.URL.Query().Get("code"), oauth2.SetAuthURLParam("code_verifier", verifierCookie.Value))
	if err != nil {
		return nil, fmt.Errorf("token exchange: %w", err)
	}
	rawID, ok := token.Extra("id_token").(string)
	if !ok || rawID == "" {
		return nil, fmt.Errorf("id_token missing")
	}
	idToken, err := s.verifier.Verify(ctx, rawID)
	if err != nil {
		return nil, fmt.Errorf("verify id_token: %w", err)
	}
	var claims struct {
		Sub   string `json:"sub"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err = idToken.Claims(&claims); err != nil {
		return nil, err
	}
	user, err := s.upsertOIDCUser(claims.Sub, claims.Email, claims.Name)
	if err != nil {
		return nil, err
	}
	if err = s.CreateSession(w, user.ID); err != nil {
		return nil, err
	}
	clearCookie(w, "cap_oidc_state", s.cfg.CookieSecure)
	clearCookie(w, "cap_oidc_verifier", s.cfg.CookieSecure)
	return user, nil
}

func (s *Service) DevLogin(w http.ResponseWriter, email, name string, admin bool) (*models.User, error) {
	if !s.cfg.DevAuthEnabled {
		return nil, fmt.Errorf("dev auth disabled")
	}
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		email = "dev@localhost"
	}
	if name == "" {
		name = "Dev User"
	}
	sub := "dev:" + email
	var user models.User
	err := s.db.Where("oidc_sub = ?", sub).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		user = models.User{
			OIDCSub: sub,
			Email:   email,
			Name:    name,
			Role:    models.RoleUser,
		}
		if admin {
			user.Role = models.RoleAdmin
		}
		// first user becomes admin
		var count int64
		_ = s.db.Model(&models.User{}).Count(&count).Error
		if count == 0 {
			user.Role = models.RoleAdmin
		}
		if err = s.db.Create(&user).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else if user.Disabled {
		return nil, ErrForbidden
	}
	if err = s.CreateSession(w, user.ID); err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Service) upsertOIDCUser(sub, email, name string) (*models.User, error) {
	sub = strings.TrimSpace(sub)
	if sub == "" {
		return nil, fmt.Errorf("empty subject")
	}
	var user models.User
	err := s.db.Where("oidc_sub = ?", sub).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		user = models.User{
			OIDCSub: sub,
			Email:   strings.ToLower(strings.TrimSpace(email)),
			Name:    strings.TrimSpace(name),
			Role:    models.RoleUser,
		}
		var count int64
		_ = s.db.Model(&models.User{}).Count(&count).Error
		if count == 0 {
			user.Role = models.RoleAdmin
		}
		if err = s.db.Create(&user).Error; err != nil {
			return nil, err
		}
		return &user, nil
	}
	if err != nil {
		return nil, err
	}
	if user.Disabled {
		return nil, ErrForbidden
	}
	updates := map[string]any{}
	if email != "" && user.Email != email {
		updates["email"] = strings.ToLower(strings.TrimSpace(email))
	}
	if name != "" && user.Name != name {
		updates["name"] = strings.TrimSpace(name)
	}
	if len(updates) > 0 {
		if err = s.db.Model(&user).Updates(updates).Error; err != nil {
			return nil, err
		}
	}
	return &user, nil
}

func (s *Service) CreateSession(w http.ResponseWriter, userID uint) error {
	id, err := randomString(32)
	if err != nil {
		return err
	}
	sess := models.Session{
		ID:        id,
		UserID:    userID,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}
	if err = s.db.Create(&sess).Error; err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     s.cfg.CookieName,
		Value:    id,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.CookieSecure,
		Expires:  sess.ExpiresAt,
	})
	return nil
}

func (s *Service) Logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(s.cfg.CookieName); err == nil && c.Value != "" {
		_ = s.db.Delete(&models.Session{}, "id = ?", c.Value).Error
	}
	clearCookie(w, s.cfg.CookieName, s.cfg.CookieSecure)
}

func (s *Service) CurrentUser(r *http.Request) (*models.User, error) {
	c, err := r.Cookie(s.cfg.CookieName)
	if err != nil || c.Value == "" {
		return nil, ErrUnauthorized
	}
	var sess models.Session
	if err = s.db.Where("id = ?", c.Value).First(&sess).Error; err != nil {
		return nil, ErrUnauthorized
	}
	if time.Now().After(sess.ExpiresAt) {
		_ = s.db.Delete(&models.Session{}, "id = ?", sess.ID).Error
		return nil, ErrUnauthorized
	}
	var user models.User
	if err = s.db.First(&user, sess.UserID).Error; err != nil {
		return nil, ErrUnauthorized
	}
	if user.Disabled {
		return nil, ErrForbidden
	}
	return &user, nil
}

func (s *Service) RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, err := s.CurrentUser(r)
		if err != nil {
			writeAuthError(w, err)
			return
		}
		ctx := context.WithValue(r.Context(), userContextKey{}, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Service) RequireAdmin(next http.Handler) http.Handler {
	return s.RequireUser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		if user == nil || user.Role != models.RoleAdmin {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	}))
}

type userContextKey struct{}

func UserFromContext(ctx context.Context) *models.User {
	u, _ := ctx.Value(userContextKey{}).(*models.User)
	return u
}

func WebRedirect(cfg config.Config, path string) string {
	base := strings.TrimRight(cfg.WebOrigin, "/")
	if path == "" {
		return base + "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return base + path
}

func LoginURL(cfg config.Config, errMsg string) string {
	u, _ := url.Parse(WebRedirect(cfg, "/login"))
	if errMsg != "" {
		q := u.Query()
		q.Set("error", errMsg)
		u.RawQuery = q.Encode()
	}
	return u.String()
}

func writeAuthError(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrForbidden) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}
	http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
}

func clearCookie(w http.ResponseWriter, name string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
		MaxAge:   -1,
	})
}

func randomString(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func pkceChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
