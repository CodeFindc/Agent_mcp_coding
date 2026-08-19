package skills

import "encoding/json"

// Platform tool names handled by the chat loop (not forwarded to MCP).
const (
	ToolListSkills = "list_skills"
	ToolLoadSkill  = "load_skill"
)

// IsPlatformTool reports whether name is a skills meta-tool.
func IsPlatformTool(name string) bool {
	switch name {
	case ToolListSkills, ToolLoadSkill:
		return true
	default:
		return false
	}
}

// ToolDefinitions returns OpenAI-style tool schemas for skill meta-tools.
// Returned as generic maps so chat can convert without importing llm here cycles.
type ToolSchema struct {
	Name        string
	Description string
	Parameters  json.RawMessage
}

func MetaToolSchemas() []ToolSchema {
	emptyObj := json.RawMessage(`{"type":"object","properties":{}}`)
	loadParams := json.RawMessage(`{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Skill name from the catalog (directory name under .agents/skills, e.g. pr-review)"
    }
  },
  "required": ["name"],
  "additionalProperties": false
}`)
	return []ToolSchema{
		{
			Name:        ToolListSkills,
			Description: "List available SKILL.md packages (name, description, scope). Use before load_skill if the catalog may have changed.",
			Parameters:  emptyObj,
		},
		{
			Name:        ToolLoadSkill,
			Description: "Load the full body of a skill by name. Call this when a skill's description matches the user task, then follow its instructions.",
			Parameters:  loadParams,
		},
	}
}
