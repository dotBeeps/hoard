// Package anthropic implements llm.Provider via the Anthropic SDK.
package anthropic

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	anthropicsdk "github.com/anthropics/anthropic-sdk-go"

	"github.com/dotBeeps/hoard/storybook-daemon/internal/auth"
	"github.com/dotBeeps/hoard/storybook-daemon/internal/llm"
)

// Provider wraps the Anthropic Messages API and implements llm.Provider.
// It manages the full multi-turn tool-use loop internally.
type Provider struct {
	client    anthropicsdk.Client
	oauth     *auth.PiOAuth
	model     anthropicsdk.Model
	maxTokens int64
	log       *slog.Logger
}

// New creates a Provider. model defaults to claude-haiku-4-5 if empty.
func New(oauth *auth.PiOAuth, model anthropicsdk.Model, maxTokens int64, log *slog.Logger) *Provider {
	if model == "" {
		model = anthropicsdk.ModelClaudeHaiku4_5
	}
	if maxTokens == 0 {
		maxTokens = 1024
	}
	return &Provider{
		client:    anthropicsdk.NewClient(),
		oauth:     oauth,
		model:     model,
		maxTokens: maxTokens,
		log:       log,
	}
}

// Run sends the system prompt and user context to the Anthropic API, managing
// the tool-use loop until the model signals end-of-turn.
func (p *Provider) Run(
	ctx context.Context,
	system string,
	userContext string,
	tools []llm.Tool,
	onText func(string),
	dispatch func(llm.ToolCall) (string, bool),
) error {
	authOpt, err := p.oauth.Option(ctx)
	if err != nil {
		return fmt.Errorf("getting auth token: %w", err)
	}

	messages := []anthropicsdk.MessageParam{
		anthropicsdk.NewUserMessage(anthropicsdk.NewTextBlock(userContext)),
	}

	for {
		resp, err := p.client.Messages.New(ctx, anthropicsdk.MessageNewParams{
			Model:     p.model,
			MaxTokens: p.maxTokens,
			System:    []anthropicsdk.TextBlockParam{{Text: system}},
			Tools:     toSDKTools(tools),
			Messages:  messages,
		}, authOpt)
		if err != nil {
			return fmt.Errorf("anthropic API: %w", err)
		}

		p.log.Debug("anthropic response",
			"stop_reason", resp.StopReason,
			"blocks", len(resp.Content),
		)

		var toolResults []anthropicsdk.ContentBlockParamUnion
		for _, block := range resp.Content {
			switch v := block.AsAny().(type) {
			case anthropicsdk.TextBlock:
				if onText != nil && strings.TrimSpace(v.Text) != "" {
					onText(v.Text)
				}
			case anthropicsdk.ToolUseBlock:
				if dispatch == nil {
					toolResults = append(toolResults, anthropicsdk.NewToolResultBlock(v.ID, "tool dispatch not available", true))
					continue
				}
				result, isError := dispatch(llm.ToolCall{
					ID:    v.ID,
					Name:  v.Name,
					Input: v.Input,
				})
				toolResults = append(toolResults, anthropicsdk.NewToolResultBlock(v.ID, result, isError))
			}
		}

		messages = append(messages, resp.ToParam())

		switch resp.StopReason {
		case anthropicsdk.StopReasonEndTurn, anthropicsdk.StopReasonStopSequence:
			return nil
		case anthropicsdk.StopReasonToolUse:
			if len(toolResults) > 0 {
				messages = append(messages, anthropicsdk.NewUserMessage(toolResults...))
				continue
			}
		}
		return nil
	}
}

func toSDKTools(tools []llm.Tool) []anthropicsdk.ToolUnionParam {
	result := make([]anthropicsdk.ToolUnionParam, 0, len(tools))
	for _, t := range tools {
		result = append(result, anthropicsdk.ToolUnionParam{
			OfTool: &anthropicsdk.ToolParam{
				Name:        t.Name,
				Description: anthropicsdk.String(t.Description),
				InputSchema: anthropicsdk.ToolInputSchemaParam{
					Type:       "object",
					Properties: t.Properties,
				},
			},
		})
	}
	return result
}
