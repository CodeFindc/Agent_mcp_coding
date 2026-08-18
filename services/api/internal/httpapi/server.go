package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/coding-agent-platform/api/internal/admin"
	"github.com/coding-agent-platform/api/internal/auth"
	"github.com/coding-agent-platform/api/internal/chat"
	"github.com/coding-agent-platform/api/internal/config"
	"github.com/coding-agent-platform/api/internal/projects"
	"github.com/coding-agent-platform/api/internal/runtime"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Server struct {
	cfg      config.Config
	auth     *auth.Service
	projects *projects.Service
	runtime  *runtime.Service
	chat     *chat.Service
	admin    *admin.Service
}

func New(
	cfg config.Config,
	authSvc *auth.Service,
	projectsSvc *projects.Service,
	runtimeSvc *runtime.Service,
	chatSvc *chat.Service,
	adminSvc *admin.Service,
) http.Handler {
	s := &Server{
		cfg:      cfg,
		auth:     authSvc,
		projects: projectsSvc,
		runtime:  runtimeSvc,
		chat:     chatSvc,
		admin:    adminSvc,
	}
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	// No global write timeout: /chat/send is long-lived SSE.
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			r.Get("/config", s.handleAuthConfig)
			r.Post("/dev-login", s.handleDevLogin)
			r.Get("/oidc/login", s.handleOIDCLogin)
			r.Get("/oidc/callback", s.handleOIDCCallback)
			r.Post("/logout", s.handleLogout)
			r.With(s.auth.RequireUser).Get("/me", s.handleMe)
		})

		r.Group(func(r chi.Router) {
			r.Use(s.auth.RequireUser)

			r.Get("/projects", s.handleListProjects)
			r.Post("/projects", s.handleCreateProject)
			r.Delete("/projects/{id}", s.handleDeleteProject)

			// Per-project runtimes (one container per project; parallel OK).
			r.Get("/projects/{id}/runtime", s.handleProjectRuntimeStatus)
			r.Post("/projects/{id}/runtime/start", s.handleProjectRuntimeStart)
			r.Post("/projects/{id}/runtime/stop", s.handleProjectRuntimeStop)
			// Backward-compatible alias for start.
			r.Post("/projects/{id}/activate", s.handleProjectRuntimeStart)

			r.Get("/runtimes", s.handleListRuntimes)

			r.Get("/projects/{id}/threads", s.handleListThreads)
			r.Post("/projects/{id}/threads", s.handleCreateThread)
			r.Get("/threads/{id}/messages", s.handleListMessages)
			r.Post("/chat/send", s.handleChatSend)
		})

		r.Route("/admin", func(r chi.Router) {
			r.Use(s.auth.RequireAdmin)
			r.Get("/providers", s.handleListProviders)
			r.Post("/providers", s.handleCreateProvider)
			r.Patch("/providers/{id}", s.handleUpdateProvider)
			r.Delete("/providers/{id}", s.handleDeleteProvider)
			r.Get("/users", s.handleListUsers)
			r.Get("/platform", s.handlePlatformInfo)
		})
	})

	return r
}

func (s *Server) handleAuthConfig(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"devAuthEnabled": s.cfg.DevAuthEnabled,
		"oidcEnabled":    s.auth.OIDCEnabled(),
	})
}

func (s *Server) handleDevLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
		Name  string `json:"name"`
		Admin bool   `json:"admin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	user, err := s.auth.DevLogin(w, body.Email, body.Name, body.Admin)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) handleOIDCLogin(w http.ResponseWriter, r *http.Request) {
	url, err := s.auth.BeginOIDC(w, r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	http.Redirect(w, r, url, http.StatusFound)
}

func (s *Server) handleOIDCCallback(w http.ResponseWriter, r *http.Request) {
	if _, err := s.auth.CompleteOIDC(w, r); err != nil {
		http.Redirect(w, r, auth.LoginURL(s.cfg, err.Error()), http.StatusFound)
		return
	}
	http.Redirect(w, r, auth.WebRedirect(s.cfg, "/"), http.StatusFound)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.auth.Logout(w, r)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, auth.UserFromContext(r.Context()))
}

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	items, err := s.projects.List(user.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	var input projects.CreateInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	p, err := s.projects.Create(user.ID, input)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (s *Server) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.projects.Delete(user.ID, id); err != nil {
		writeProjectErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleProjectRuntimeStatus(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	st, err := s.runtime.Status(user.ID, id)
	if err != nil {
		writeProjectErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) handleProjectRuntimeStart(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	st, err := s.runtime.Start(user.ID, id)
	if err != nil {
		if errors.Is(err, runtime.ErrQuotaExceeded) {
			writeErr(w, http.StatusConflict, err.Error())
			return
		}
		writeProjectErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) handleProjectRuntimeStop(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.runtime.Stop(user.ID, id); err != nil {
		writeProjectErr(w, err)
		return
	}
	st, _ := s.runtime.Status(user.ID, id)
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) handleListRuntimes(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	summary, err := s.runtime.List(user.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (s *Server) handleListThreads(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	pid, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	items, err := s.chat.ListThreads(user.ID, pid)
	if err != nil {
		writeProjectErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleCreateThread(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	pid, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var body struct {
		Title string `json:"title"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	t, err := s.chat.CreateThread(user.ID, pid, body.Title)
	if err != nil {
		writeProjectErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (s *Server) handleListMessages(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	items, err := s.chat.ListMessages(user.ID, id)
	if err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleChatSend(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	var input chat.SendInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeErr(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	emit := func(ev chat.Event) {
		raw, _ := json.Marshal(ev)
		_, _ = fmt.Fprintf(w, "data: %s\n\n", raw)
		flusher.Flush()
	}

	// long-running chat; detach from default timeouts via request context only
	ctx := r.Context()
	if err := s.chat.Send(ctx, user.ID, input, emit); err != nil {
		// error already emitted in most paths
		if !strings.Contains(err.Error(), "tool call limit") && !strings.Contains(err.Error(), "max rounds") {
			emit(chat.Event{Type: "error", Error: err.Error()})
		}
	}
}

func (s *Server) handleListProviders(w http.ResponseWriter, r *http.Request) {
	items, err := s.admin.ListProviders()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleCreateProvider(w http.ResponseWriter, r *http.Request) {
	var input admin.ProviderInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	p, err := s.admin.CreateProvider(input)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (s *Server) handleUpdateProvider(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var input admin.ProviderInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	p, err := s.admin.UpdateProvider(id, input)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handleDeleteProvider(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.admin.DeleteProvider(id); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	items, err := s.admin.ListUsers()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handlePlatformInfo(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.admin.PlatformInfo(s.auth.OIDCEnabled()))
}

func pathID(r *http.Request, name string) (uint, error) {
	raw := chi.URLParam(r, name)
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(n), nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeProjectErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, projects.ErrNotFound), errors.Is(err, chat.ErrNotFound):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, projects.ErrDenied):
		writeErr(w, http.StatusForbidden, err.Error())
	default:
		writeErr(w, http.StatusBadRequest, err.Error())
	}
}

