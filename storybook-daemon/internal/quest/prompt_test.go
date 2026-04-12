package quest

import (
	"strings"
	"testing"
)

func TestBuildPromptContainsIdentity(t *testing.T) {
	combo := &AllyCombo{Adjective: "silly", Noun: "kobold", Job: "scout"}
	prompt := BuildAllyPrompt(combo, "Grix")
	if !strings.Contains(prompt, "You are Grix the Silly Kobold Scout.") {
		t.Errorf("prompt missing identity line, got:\n%s", prompt[:200])
	}
}

func TestBuildPromptContainsJobSection(t *testing.T) {
	combo := &AllyCombo{Adjective: "clever", Noun: "griffin", Job: "coder"}
	prompt := BuildAllyPrompt(combo, "")
	if !strings.Contains(prompt, "## Your Job") {
		t.Error("prompt missing job section")
	}
	if !strings.Contains(prompt, "Write and edit code") {
		t.Error("prompt missing coder job description")
	}
}

func TestBuildPromptContainsStoneDocs(t *testing.T) {
	combo := &AllyCombo{Adjective: "wise", Noun: "dragon", Job: "planner"}
	prompt := BuildAllyPrompt(combo, "Azurath")
	if !strings.Contains(prompt, "stone_send") {
		t.Error("prompt missing stone_send instructions")
	}
	if !strings.Contains(prompt, "stone_receive") {
		t.Error("prompt missing stone_receive instructions")
	}
}

func TestBuildPromptNoName(t *testing.T) {
	combo := &AllyCombo{Adjective: "silly", Noun: "kobold", Job: "scout"}
	prompt := BuildAllyPrompt(combo, "")
	if !strings.Contains(prompt, "You are a Silly Kobold Scout.") {
		t.Errorf("prompt missing anonymous identity, got:\n%s", prompt[:200])
	}
}
