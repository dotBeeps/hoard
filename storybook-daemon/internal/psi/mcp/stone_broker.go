package mcp

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/dotBeeps/hoard/storybook-daemon/internal/stone"
)

// Broker is an in-process message broker for stone messages.
// Each registered session gets its own ring buffer.
type Broker struct {
	mu       sync.Mutex
	sessions map[string]*sessionRing
	cap      int
	nextID   atomic.Int64
}

type sessionRing struct {
	msgs []stone.Message
	subs []chan stone.Message
}

// NewBroker creates a Broker with the given ring buffer capacity per session.
func NewBroker(ringCap int) *Broker {
	return &Broker{
		sessions: make(map[string]*sessionRing),
		cap:      ringCap,
	}
}

// RegisterSession adds a new session ring. Idempotent — no-op if already registered.
func (b *Broker) RegisterSession(sessionID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, ok := b.sessions[sessionID]; !ok {
		b.sessions[sessionID] = &sessionRing{}
	}
}

// UnregisterSession removes the session, closing all subscriber channels.
func (b *Broker) UnregisterSession(sessionID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if ring, ok := b.sessions[sessionID]; ok {
		for _, ch := range ring.subs {
			close(ch)
		}
	}
	delete(b.sessions, sessionID)
}

// Send delivers msg to the session ring buffer and all active subscribers.
// It auto-assigns ID and Timestamp if they are zero.
func (b *Broker) Send(_ context.Context, sessionID string, msg stone.Message) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	ring, ok := b.sessions[sessionID]
	if !ok {
		return fmt.Errorf("unknown session: %s", sessionID)
	}

	if msg.ID == "" {
		msg.ID = "stone-" + strconv.FormatInt(b.nextID.Add(1), 10)
	}
	if msg.Timestamp == 0 {
		msg.Timestamp = time.Now().UnixMilli()
	}

	ring.msgs = append(ring.msgs, msg)
	if len(ring.msgs) > b.cap {
		ring.msgs = ring.msgs[len(ring.msgs)-b.cap:]
	}

	for _, ch := range ring.subs {
		select {
		case ch <- msg:
		default:
		}
	}

	return nil
}

// History returns all messages for the session. If sinceID is non-empty, only
// messages after that ID are returned. Returns nil for an unknown session.
func (b *Broker) History(sessionID string, sinceID string) []stone.Message {
	b.mu.Lock()
	defer b.mu.Unlock()

	ring, ok := b.sessions[sessionID]
	if !ok {
		return nil
	}

	if sinceID == "" {
		out := make([]stone.Message, len(ring.msgs))
		copy(out, ring.msgs)
		return out
	}

	for i, m := range ring.msgs {
		if m.ID == sinceID && i+1 < len(ring.msgs) {
			out := make([]stone.Message, len(ring.msgs)-i-1)
			copy(out, ring.msgs[i+1:])
			return out
		}
	}
	return nil
}

// Subscribe returns a channel that receives new messages for this session and a
// cancel func that removes the subscription.
func (b *Broker) Subscribe(sessionID string) (<-chan stone.Message, func()) {
	b.mu.Lock()
	defer b.mu.Unlock()

	ring, ok := b.sessions[sessionID]
	if !ok {
		ch := make(chan stone.Message)
		close(ch)
		return ch, func() {}
	}

	ch := make(chan stone.Message, 16)
	ring.subs = append(ring.subs, ch)

	cancel := func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		ring2, ok2 := b.sessions[sessionID]
		if !ok2 {
			return
		}
		for i, sub := range ring2.subs {
			if sub == ch {
				ring2.subs = append(ring2.subs[:i], ring2.subs[i+1:]...)
				break
			}
		}
	}

	return ch, cancel
}

// Receive returns messages addressed to addressedTo in the given session.
// Long-polls up to waitDur. Returns empty slice on timeout.
func (b *Broker) Receive(ctx context.Context, sessionID, addressedTo, sinceID string, waitDur time.Duration) ([]stone.Message, error) {
	existing := b.filterAddressed(b.History(sessionID, sinceID), addressedTo)
	if len(existing) > 0 {
		return existing, nil
	}

	ch, unsub := b.Subscribe(sessionID)
	defer unsub()

	timer := time.NewTimer(waitDur)
	defer timer.Stop()

	var collected []stone.Message
	for {
		select {
		case msg, ok := <-ch:
			if !ok {
				return collected, nil
			}
			if msg.Addressing == addressedTo || msg.Addressing == "session-room" {
				collected = append(collected, msg)
				return collected, nil
			}
		case <-timer.C:
			return collected, nil
		case <-ctx.Done():
			return collected, ctx.Err()
		}
	}
}

func (b *Broker) filterAddressed(msgs []stone.Message, addressedTo string) []stone.Message {
	var out []stone.Message
	for _, m := range msgs {
		if m.Addressing == addressedTo || m.Addressing == "session-room" {
			out = append(out, m)
		}
	}
	return out
}
