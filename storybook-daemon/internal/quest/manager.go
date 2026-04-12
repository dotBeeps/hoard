package quest

import (
	"bufio"
	"context"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// BrokerSender is the interface the manager uses to post quest events to stone.
type BrokerSender interface {
	Send(ctx context.Context, sessionID string, msg any) error
}

// Manager owns the lifecycle of all running quests.
type Manager struct {
	mu        sync.Mutex
	quests    map[string]*Quest
	bySession map[string][]string
	broker    BrokerSender
	logFn     func(args ...any)
	nextID    atomic.Int64
}

// NewManager constructs a Manager. broker may be nil in v1 (results go to stdout only).
func NewManager(broker BrokerSender, logFn func(args ...any)) *Manager {
	return &Manager{
		quests:    make(map[string]*Quest),
		bySession: make(map[string][]string),
		broker:    broker,
		logFn:     logFn,
	}
}

// Dispatch validates all quest requests, registers them, and starts goroutines.
// Returns QuestInfo snapshots immediately — quests run asynchronously.
func (m *Manager) Dispatch(ctx context.Context, sessionID string, req DispatchRequest) ([]QuestInfo, error) {
	if len(req.Quests) == 0 {
		return nil, fmt.Errorf("no quests to dispatch")
	}

	var infos []QuestInfo

	for _, qr := range req.Quests {
		combo := ParseDefName(qr.Ally)
		if combo == nil {
			return nil, fmt.Errorf("invalid ally defName: %q", qr.Ally)
		}

		model := qr.Model
		if model == "" {
			model = ResolveModel(combo.Noun)
		}

		timeoutMs := qr.TimeoutMs
		if timeoutMs <= 0 {
			timeoutMs = JobDefaults(combo.Job).TimeoutMs
		}

		id := "quest-" + strconv.FormatInt(m.nextID.Add(1), 10)

		q := &Quest{
			ID:        id,
			SessionID: sessionID,
			Ally:      qr.Ally,
			Combo:     combo,
			Harness:   qr.Harness,
			Model:     model,
			Task:      qr.Task,
			Status:    StatusPending,
			StartedAt: time.Now(),
		}

		m.mu.Lock()
		m.quests[id] = q
		m.bySession[sessionID] = append(m.bySession[sessionID], id)
		m.mu.Unlock()

		infos = append(infos, q.Info())

		go m.runQuest(ctx, q, time.Duration(timeoutMs)*time.Millisecond)
	}

	return infos, nil
}

func (m *Manager) runQuest(_ context.Context, q *Quest, timeout time.Duration) {
	m.setStatus(q, StatusSpawning)

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	q.cancel = cancel
	defer cancel()

	cmd, err := m.buildCommand(ctx, q)
	if err != nil {
		m.failQuest(q, fmt.Sprintf("build command: %v", err))
		return
	}

	m.setStatus(q, StatusRunning)

	stderr, _ := cmd.StderrPipe()
	stdout, _ := cmd.StdoutPipe()

	if err := cmd.Start(); err != nil {
		m.failQuest(q, fmt.Sprintf("start: %v", err))
		return
	}

	m.mu.Lock()
	q.PID = cmd.Process.Pid
	m.mu.Unlock()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			m.mu.Lock()
			q.LastStderr = scanner.Text()
			m.mu.Unlock()
		}
	}()

	var output strings.Builder
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		output.WriteString(scanner.Text())
		output.WriteByte('\n')
	}

	err = cmd.Wait()
	now := time.Now()

	m.mu.Lock()
	q.FinishedAt = &now
	m.mu.Unlock()

	if ctx.Err() == context.DeadlineExceeded {
		m.setStatus(q, StatusTimeout)
		m.mu.Lock()
		q.Error = "timeout"
		m.mu.Unlock()
		return
	}

	if ctx.Err() == context.Canceled {
		m.setStatus(q, StatusCancelled)
		m.mu.Lock()
		q.Error = "cancelled"
		m.mu.Unlock()
		return
	}

	if err != nil {
		exitCode := cmd.ProcessState.ExitCode()
		m.mu.Lock()
		q.ExitCode = &exitCode
		q.Error = err.Error()
		q.Response = output.String()
		m.mu.Unlock()
		m.setStatus(q, StatusFailed)
		return
	}

	exitCode := 0
	m.mu.Lock()
	q.ExitCode = &exitCode
	q.Response = strings.TrimSpace(output.String())
	m.mu.Unlock()
	m.setStatus(q, StatusCompleted)
}

func (m *Manager) buildCommand(ctx context.Context, q *Quest) (*exec.Cmd, error) {
	switch q.Harness {
	case "mock":
		parts := strings.Fields(q.Task)
		if len(parts) == 0 {
			return nil, fmt.Errorf("empty task")
		}
		return exec.CommandContext(ctx, parts[0], parts[1:]...), nil

	case "pi":
		return exec.CommandContext(ctx, "pi",
			"--mode", "json",
			"-p",
			"--model", q.Model,
			q.Task,
		), nil

	case "claude":
		return exec.CommandContext(ctx, "claude",
			"--print",
			"--model", q.Model,
			q.Task,
		), nil

	default:
		return nil, fmt.Errorf("unknown harness: %q", q.Harness)
	}
}

func (m *Manager) setStatus(q *Quest, status Status) {
	m.mu.Lock()
	defer m.mu.Unlock()
	q.Status = status
}

func (m *Manager) failQuest(q *Quest, errMsg string) {
	m.mu.Lock()
	q.Error = errMsg
	now := time.Now()
	q.FinishedAt = &now
	m.mu.Unlock()
	m.setStatus(q, StatusFailed)
}

// Status returns snapshots for the given quest IDs, or all quests in the session if ids is nil/empty.
func (m *Manager) Status(sessionID string, questIDs []string) []QuestInfo {
	m.mu.Lock()
	defer m.mu.Unlock()

	ids := questIDs
	if len(ids) == 0 {
		ids = m.bySession[sessionID]
	}

	var infos []QuestInfo
	for _, id := range ids {
		q, ok := m.quests[id]
		if !ok || q.SessionID != sessionID {
			continue
		}
		infos = append(infos, q.Info())
	}
	return infos
}

// Cancel cancels a single quest by ID.
func (m *Manager) Cancel(sessionID, questID string) error {
	m.mu.Lock()
	q, ok := m.quests[questID]
	m.mu.Unlock()

	if !ok || q.SessionID != sessionID {
		return fmt.Errorf("quest not found: %s", questID)
	}

	if q.cancel != nil {
		q.cancel()
	}
	return nil
}

// Cleanup cancels all quests for a session and removes them from the manager.
func (m *Manager) Cleanup(sessionID string) {
	m.mu.Lock()
	ids := m.bySession[sessionID]
	delete(m.bySession, sessionID)

	for _, id := range ids {
		q, ok := m.quests[id]
		if ok && q.cancel != nil {
			q.cancel()
		}
		delete(m.quests, id)
	}
	m.mu.Unlock()
}
