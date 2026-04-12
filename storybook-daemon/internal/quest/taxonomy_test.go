package quest

import "testing"

func TestParseDefName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantNil  bool
		wantAdj  string
		wantNoun string
		wantJob  string
	}{
		{"valid kobold scout", "silly-kobold-scout", false, "silly", "kobold", "scout"},
		{"valid dragon planner", "elder-dragon-planner", false, "elder", "dragon", "planner"},
		{"invalid adjective", "fast-kobold-scout", true, "", "", ""},
		{"too few parts", "kobold-scout", true, "", "", ""},
		{"too many parts", "silly-kobold-scout-extra", true, "", "", ""},
		{"empty", "", true, "", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			combo := ParseDefName(tt.input)
			if tt.wantNil {
				if combo != nil {
					t.Errorf("ParseDefName(%q) = %+v, want nil", tt.input, combo)
				}
				return
			}
			if combo == nil {
				t.Fatalf("ParseDefName(%q) = nil, want combo", tt.input)
			}
			if combo.Adjective != tt.wantAdj {
				t.Errorf("Adjective = %q, want %q", combo.Adjective, tt.wantAdj)
			}
			if combo.Noun != tt.wantNoun {
				t.Errorf("Noun = %q, want %q", combo.Noun, tt.wantNoun)
			}
			if combo.Job != tt.wantJob {
				t.Errorf("Job = %q, want %q", combo.Job, tt.wantJob)
			}
		})
	}
}

func TestResolveModel(t *testing.T) {
	tests := []struct {
		noun string
		want string
	}{
		{"kobold", "zai/glm-4.5-air"},
		{"griffin", "github-copilot/claude-sonnet-4.6"},
		{"dragon", "github-copilot/claude-opus-4.6"},
	}
	for _, tt := range tests {
		t.Run(tt.noun, func(t *testing.T) {
			got := ResolveModel(tt.noun)
			if got != tt.want {
				t.Errorf("ResolveModel(%q) = %q, want %q", tt.noun, got, tt.want)
			}
		})
	}
}

func TestResolveTools(t *testing.T) {
	got := ResolveTools("scout")
	if got == "" {
		t.Fatal("ResolveTools(scout) returned empty")
	}
}

func TestResolveThinking(t *testing.T) {
	if got := ResolveThinking("silly"); got != "off" {
		t.Errorf("silly thinking = %q, want off", got)
	}
	if got := ResolveThinking("elder"); got != "high" {
		t.Errorf("elder thinking = %q, want high", got)
	}
}

func TestJobDefaults(t *testing.T) {
	d := JobDefaults("scout")
	if d.TimeoutMs != 180_000 {
		t.Errorf("scout timeout = %d, want 180000", d.TimeoutMs)
	}
	if d.CheckInIntervalMs != 15_000 {
		t.Errorf("scout check-in = %d, want 15000", d.CheckInIntervalMs)
	}
}
