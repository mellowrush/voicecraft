## Agent skills

### Issue tracker

Issues tracked in GitHub Issues (`mellowrush/voicecraft`), via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

## AI Response Behavior
* **Brevity:** Provide raw code immediately. Skip introduction ("Sure, here is...") and summary text.
* **Explanations:** Maximum 2 sentences of explanation per code block. Only explain non-obvious logic.
* **Code Modifications:** Show only the changed lines or functions. Do not rewrite entire files.
* **Commit messages:** Use succint  raw code immediately. Skip introduction ("Sure, here is...") and summary text.



## Commits 
* **Prefixes for Commit Messages** Use one of the following prefixes for the commit messages:

fix -> Addressing Issues
release -> Version Updates
feat -> Introducing New Functionality
bug -> Fixing Bugs
refactor -> Code Refactoring
doc -> Documentation Updates
test -> Adding or Modifying Tests
style -> Code Style Changes
Commit messages should be concise and to the point, one-liner, at maximum 150 characters including the prefix. Never include "Co-authored by " label.