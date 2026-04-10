package llamacli_test

import (
	"testing"

	"github.com/dotBeeps/hoard/storybook-daemon/internal/llm/llamacli"
)

func TestSplitThinkBlock(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		input     string
		wantThink string
		wantReply string
	}{
		{
			name:      "standard deepseek r1 output",
			input:     "<think>\ninner monologue here\n</think>\nActual reply to the user.",
			wantThink: "inner monologue here",
			wantReply: "Actual reply to the user.",
		},
		{
			name:      "no think block",
			input:     "Just a plain response.",
			wantThink: "",
			wantReply: "Just a plain response.",
		},
		{
			name:      "empty think block",
			input:     "<think></think>The reply.",
			wantThink: "",
			wantReply: "The reply.",
		},
		{
			name:      "unclosed think block",
			input:     "<think>only thinking, no reply",
			wantThink: "only thinking, no reply",
			wantReply: "",
		},
		{
			name:      "multiline think and reply",
			input:     "<think>\nLine one.\nLine two.\n</think>\n\nParagraph one.\n\nParagraph two.",
			wantThink: "Line one.\nLine two.",
			wantReply: "Paragraph one.\n\nParagraph two.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			gotThink, gotReply := llamacli.SplitThinkBlock(tt.input)
			if gotThink != tt.wantThink {
				t.Errorf("think: got %q, want %q", gotThink, tt.wantThink)
			}
			if gotReply != tt.wantReply {
				t.Errorf("reply: got %q, want %q", gotReply, tt.wantReply)
			}
		})
	}
}
