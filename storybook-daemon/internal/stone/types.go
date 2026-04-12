package stone

// Message mirrors the pi-side StoneMessage schema.
// See den/features/hoard-sending-stone/AGENTS.md for the canonical spec.
type Message struct {
	ID          string         `json:"id"`
	From        string         `json:"from"`
	DisplayName string         `json:"displayName,omitempty"`
	Addressing  string         `json:"addressing"`
	Type        string         `json:"type"`
	Content     string         `json:"content"`
	Color       string         `json:"color,omitempty"`
	Metadata    map[string]any `json:"metadata,omitempty"`
	Timestamp   int64          `json:"timestamp"`
}

// Key is the global symbol key for the stone API.
const Key = "hoard.stone"
