package quest

import (
	"slices"
	"strings"
)

var (
	Adjectives = []string{"silly", "clever", "wise", "elder"}
	Nouns      = []string{"kobold", "griffin", "dragon"}
	Jobs       = []string{"scout", "reviewer", "coder", "researcher", "planner"}
)

type AllyCombo struct {
	Adjective string
	Noun      string
	Job       string
}

func ParseDefName(defName string) *AllyCombo {
	parts := strings.Split(defName, "-")
	if len(parts) != 3 {
		return nil
	}
	adj, noun, job := parts[0], parts[1], parts[2]
	if !slices.Contains(Adjectives, adj) {
		return nil
	}
	if !slices.Contains(Nouns, noun) {
		return nil
	}
	if !slices.Contains(Jobs, job) {
		return nil
	}
	return &AllyCombo{Adjective: adj, Noun: noun, Job: job}
}

func (c *AllyCombo) DefName() string {
	return c.Adjective + "-" + c.Noun + "-" + c.Job
}

var defaultModels = map[string][]string{
	"kobold": {
		"zai/glm-4.5-air",
		"github-copilot/claude-haiku-4.5",
		"anthropic/claude-haiku-4-5",
		"google/gemini-2.0-flash",
	},
	"griffin": {
		"github-copilot/claude-sonnet-4.6",
		"anthropic/claude-sonnet-4-6",
		"google/gemini-2.5-pro",
	},
	"dragon": {
		"github-copilot/claude-opus-4.6",
		"anthropic/claude-opus-4-6",
	},
}

func ResolveModel(noun string) string {
	models, ok := defaultModels[noun]
	if !ok || len(models) == 0 {
		return "zai/glm-4.5-air"
	}
	return models[0]
}

func ModelCascade(noun string) []string {
	models, ok := defaultModels[noun]
	if !ok {
		return []string{"zai/glm-4.5-air"}
	}
	out := make([]string, len(models))
	copy(out, models)
	return out
}

var defaultThinking = map[string]string{
	"silly":  "off",
	"clever": "low",
	"wise":   "medium",
	"elder":  "high",
}

func ResolveThinking(adjective string) string {
	t, ok := defaultThinking[adjective]
	if !ok {
		return "off"
	}
	return t
}

const socialTools = "stone_send,stone_receive,write_notes"

var jobTools = map[string]string{
	"scout":      "read,grep,find,ls,bash," + socialTools,
	"reviewer":   "read,grep,find,ls,bash," + socialTools,
	"coder":      "read,grep,find,ls,bash,write,edit," + socialTools,
	"researcher": "read,grep,find,ls,bash," + socialTools,
	"planner":    "read,grep,find,ls," + socialTools,
}

func ResolveTools(job string) string {
	tools, ok := jobTools[job]
	if !ok {
		return "read,grep,find,ls,bash," + socialTools
	}
	return tools
}

type JobDefaultsResult struct {
	TimeoutMs         int
	CheckInIntervalMs int
}

var jobDefaultsMap = map[string]JobDefaultsResult{
	"scout":      {TimeoutMs: 180_000, CheckInIntervalMs: 15_000},
	"reviewer":   {TimeoutMs: 120_000, CheckInIntervalMs: 20_000},
	"coder":      {TimeoutMs: 180_000, CheckInIntervalMs: 30_000},
	"researcher": {TimeoutMs: 300_000, CheckInIntervalMs: 45_000},
	"planner":    {TimeoutMs: 180_000, CheckInIntervalMs: 30_000},
}

func JobDefaults(job string) JobDefaultsResult {
	d, ok := jobDefaultsMap[job]
	if !ok {
		return JobDefaultsResult{TimeoutMs: 180_000, CheckInIntervalMs: 30_000}
	}
	return d
}
