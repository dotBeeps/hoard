package stone_test

import (
	"encoding/json"
	"testing"

	"github.com/dotBeeps/hoard/storybook-daemon/internal/stone"
)

func TestMessageJSONRoundTrip(t *testing.T) {
	msg := stone.Message{
		ID:         "stone-1",
		From:       "silly-kobold-scout",
		Addressing: "primary-agent",
		Type:       "result",
		Content:    "finished",
		Timestamp:  1234567890,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var got stone.Message
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.ID != msg.ID || got.From != msg.From || got.Content != msg.Content {
		t.Errorf("round-trip mismatch: got %+v", got)
	}
}

func TestKeyConstant(t *testing.T) {
	if stone.Key != "hoard.stone" {
		t.Errorf("Key = %q, want %q", stone.Key, "hoard.stone")
	}
}
