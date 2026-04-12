package quest

import (
	"context"
	"sync"
	"time"
)

// Status represents the lifecycle state of a quest.
type Status string

const (
	StatusPending   Status = "pending"
	StatusSpawning  Status = "spawning"
	StatusRunning   Status = "running"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
	StatusTimeout   Status = "timeout"
	StatusCancelled Status = "cancelled"
)

// Quest holds all runtime state for a single ally subprocess.
type Quest struct {
	ID          string
	SessionID   string
	GroupID     string
	Ally        string
	Combo       *AllyCombo
	Harness     string
	Model       string
	Task        string
	SessionPath string // pi only: path to --session jsonl file
	Status      Status
	PID         int
	StartedAt   time.Time
	FinishedAt  *time.Time
	ExitCode    *int
	Response    string
	Error       string
	LastStderr  string

	cancel   context.CancelFunc
	done     chan struct{} // closed when quest reaches a terminal status
	doneOnce sync.Once
}

// Group tracks a set of quests dispatched together in rally or chain mode.
type Group struct {
	ID       string
	Mode     string // "rally" or "chain"
	QuestIDs []string
	FailFast bool // rally only: cancel remaining on first failure
	done     chan struct{}
}

// QuestInfo is the externally-visible snapshot of a quest.
type QuestInfo struct {
	QuestID    string `json:"quest_id"`
	GroupID    string `json:"group_id,omitempty"`
	Ally       string `json:"ally"`
	Harness    string `json:"harness"`
	Model      string `json:"model"`
	Status     Status `json:"status"`
	PID        int    `json:"pid,omitempty"`
	StartedAt  string `json:"started_at"`
	FinishedAt string `json:"finished_at,omitempty"`
	ElapsedMs  int64  `json:"elapsed_ms"`
	ExitCode   *int   `json:"exit_code,omitempty"`
	Summary    string `json:"result_summary,omitempty"`
	Error      string `json:"error,omitempty"`
	LastStderr string `json:"last_stderr,omitempty"`
}

// DispatchRequest is the top-level payload sent to Manager.Dispatch.
type DispatchRequest struct {
	Mode     string         `json:"mode"`
	Quests   []QuestRequest `json:"quests"`
	FailFast bool           `json:"fail_fast,omitempty"` // rally only
}

// QuestRequest describes one ally invocation within a dispatch.
type QuestRequest struct {
	Ally      string `json:"ally"`
	Task      string `json:"task"`
	Harness   string `json:"-"` // derived from model; only settable in Go (e.g. "test", "mock")
	Model     string `json:"model,omitempty"`
	TimeoutMs int    `json:"timeout_ms,omitempty"`
	Thinking  string `json:"thinking,omitempty"`
}

// Info returns a snapshot of the quest suitable for external consumption.
func (q *Quest) Info() QuestInfo {
	info := QuestInfo{
		QuestID:    q.ID,
		GroupID:    q.GroupID,
		Ally:       q.Ally,
		Harness:    q.Harness,
		Model:      q.Model,
		Status:     q.Status,
		PID:        q.PID,
		StartedAt:  q.StartedAt.Format(time.RFC3339),
		ElapsedMs:  time.Since(q.StartedAt).Milliseconds(),
		ExitCode:   q.ExitCode,
		Error:      q.Error,
		LastStderr: q.LastStderr,
	}
	if q.FinishedAt != nil {
		info.FinishedAt = q.FinishedAt.Format(time.RFC3339)
		info.ElapsedMs = q.FinishedAt.Sub(q.StartedAt).Milliseconds()
	}
	if len(q.Response) > 500 {
		info.Summary = q.Response[:500]
	} else if q.Response != "" {
		info.Summary = q.Response
	}
	return info
}
