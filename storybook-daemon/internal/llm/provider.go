// Package llm defines the provider-agnostic LLM interface used by the thought cycle.
package llm

import (
	"context"
	"encoding/json"
)

// Tool describes a callable function the model may invoke.
type Tool struct {
	Name        string
	Description string
	// Properties is the "properties" value from a JSON Schema object,
	// mapping field names to their type/description schemas.
	Properties map[string]any
	Required   []string
}

// ToolCall is a structured request from the model to invoke a tool.
type ToolCall struct {
	ID    string
	Name  string
	Input json.RawMessage
}

// Provider executes a single LLM inference turn.
// Implementations are responsible for managing any internal multi-turn loop
// required by their backend (e.g. Anthropic tool-use round-trips).
//
// onText is called for each text output chunk. dispatch is called for each
// tool the model requests; it returns the tool result and whether it was an error.
// Either callback may be nil.
type Provider interface {
	Run(
		ctx context.Context,
		system string,
		userContext string,
		tools []Tool,
		onText func(text string),
		dispatch func(call ToolCall) (result string, isError bool),
	) error
}
