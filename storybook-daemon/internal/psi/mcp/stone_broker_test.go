package mcp

import (
	"context"
	"testing"
	"time"

	"github.com/dotBeeps/hoard/storybook-daemon/internal/stone"
)

func TestBrokerSendUnknownSession(t *testing.T) {
	b := NewBroker(100)
	err := b.Send(context.Background(), "no-such-session", stone.Message{
		From:       "test",
		Addressing: "primary-agent",
		Type:       "result",
		Content:    "hello",
	})
	if err == nil {
		t.Fatal("expected error for unknown session")
	}
}

func TestBrokerSendAndHistory(t *testing.T) {
	b := NewBroker(100)
	b.RegisterSession("s1")

	msg := stone.Message{
		From:       "scout",
		Addressing: "primary-agent",
		Type:       "result",
		Content:    "found it",
	}
	if err := b.Send(context.Background(), "s1", msg); err != nil {
		t.Fatalf("send: %v", err)
	}

	msgs := b.History("s1", "")
	if len(msgs) != 1 {
		t.Fatalf("history len = %d, want 1", len(msgs))
	}
	if msgs[0].Content != "found it" {
		t.Errorf("content = %q, want %q", msgs[0].Content, "found it")
	}
	if msgs[0].ID == "" {
		t.Error("expected auto-assigned ID")
	}
	if msgs[0].Timestamp == 0 {
		t.Error("expected auto-assigned timestamp")
	}
}

func TestBrokerHistorySinceID(t *testing.T) {
	b := NewBroker(100)
	b.RegisterSession("s1")

	for i := 0; i < 3; i++ {
		_ = b.Send(context.Background(), "s1", stone.Message{
			From:       "scout",
			Addressing: "primary-agent",
			Type:       "progress",
			Content:    "msg",
		})
	}

	all := b.History("s1", "")
	if len(all) != 3 {
		t.Fatalf("history len = %d, want 3", len(all))
	}

	since := b.History("s1", all[1].ID)
	if len(since) != 1 {
		t.Fatalf("since len = %d, want 1", len(since))
	}
	if since[0].ID != all[2].ID {
		t.Errorf("since[0].ID = %q, want %q", since[0].ID, all[2].ID)
	}
}

func TestBrokerRingOverflow(t *testing.T) {
	b := NewBroker(3)
	b.RegisterSession("s1")

	for i := 0; i < 5; i++ {
		_ = b.Send(context.Background(), "s1", stone.Message{
			From:       "scout",
			Addressing: "primary-agent",
			Type:       "progress",
			Content:    "msg",
		})
	}

	msgs := b.History("s1", "")
	if len(msgs) != 3 {
		t.Fatalf("history len = %d, want 3 (ring cap)", len(msgs))
	}
}

func TestBrokerUnregisterSession(t *testing.T) {
	b := NewBroker(100)
	b.RegisterSession("s1")
	_ = b.Send(context.Background(), "s1", stone.Message{
		From: "test", Addressing: "primary-agent", Type: "result", Content: "x",
	})
	b.UnregisterSession("s1")

	msgs := b.History("s1", "")
	if len(msgs) != 0 {
		t.Fatalf("expected empty history after unregister, got %d", len(msgs))
	}
}

func TestBrokerReceiveLongPoll(t *testing.T) {
	b := NewBroker(100)
	b.RegisterSession("s1")

	go func() {
		time.Sleep(50 * time.Millisecond)
		_ = b.Send(context.Background(), "s1", stone.Message{
			From:       "scout",
			Addressing: "primary-agent",
			Type:       "result",
			Content:    "delayed result",
		})
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	msgs, err := b.Receive(ctx, "s1", "primary-agent", "", 200*time.Millisecond)
	if err != nil {
		t.Fatalf("receive: %v", err)
	}
	if len(msgs) != 1 {
		t.Fatalf("receive len = %d, want 1", len(msgs))
	}
	if msgs[0].Content != "delayed result" {
		t.Errorf("content = %q, want %q", msgs[0].Content, "delayed result")
	}
}

func TestBrokerReceiveFiltersAddressing(t *testing.T) {
	b := NewBroker(100)
	b.RegisterSession("s1")

	_ = b.Send(context.Background(), "s1", stone.Message{
		From: "scout", Addressing: "other-ally", Type: "progress", Content: "not for me",
	})
	_ = b.Send(context.Background(), "s1", stone.Message{
		From: "scout", Addressing: "primary-agent", Type: "result", Content: "for me",
	})

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	msgs, err := b.Receive(ctx, "s1", "primary-agent", "", 50*time.Millisecond)
	if err != nil {
		t.Fatalf("receive: %v", err)
	}
	if len(msgs) != 1 {
		t.Fatalf("receive len = %d, want 1", len(msgs))
	}
	if msgs[0].Content != "for me" {
		t.Errorf("content = %q", msgs[0].Content)
	}
}

func TestBrokerReceiveTimeout(t *testing.T) {
	b := NewBroker(100)
	b.RegisterSession("s1")

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	msgs, err := b.Receive(ctx, "s1", "primary-agent", "", 50*time.Millisecond)
	if err != nil {
		t.Fatalf("receive: %v", err)
	}
	if len(msgs) != 0 {
		t.Fatalf("receive len = %d, want 0 (timeout)", len(msgs))
	}
}
