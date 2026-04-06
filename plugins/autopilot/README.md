# Autopilot

Autopilot is a personal agent plugin that re-prompts the agent when it goes idle with incomplete tasks remaining.

## Layout

This plugin follows the same broad shape as `obra/superpowers`: platform-specific assets live in hidden tool directories, and the plugin stays self-contained under its own top-level folder.

```text
plugins/autopilot/
  .claude/
    commands/
  .opencode/
    commands/
    plugins/
```

## Platforms

- OpenCode: `.opencode/plugins/autopilot/`
- Claude: `.claude/commands/autopilot.md`

## Notes

- The OpenCode plugin code is copied from `~/Working/github.com/pirackr/arbiter`
- The Claude and OpenCode command wrappers are included alongside the plugin
