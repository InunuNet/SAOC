---
description: View or change the workspace autonomy level
---

# /autonomy

Manage the workspace autonomy level — what agents can do without asking.

## Commands

### View current level
```
/autonomy
```
Prints the current level and what it permits.

### Set level
```
/autonomy set off|low|medium|high
```
Updates `autonomy.level` in `.agent/profile.json`.

**off** — read-only; all writes and shell commands require confirmation  
**low** — memory writes + safe read-only shell commands allowed  
**medium** *(default)* — all project file writes + build tools; no infra/config writes  
**high** — full project access + release/deploy commands; use with care

### Implementation
Run:
```bash
python3 -c "
import json, datetime
p = json.load(open('.agent/profile.json'))
p.setdefault('autonomy', {})['level'] = '<LEVEL>'
p['autonomy']['updated_at'] = datetime.datetime.now(datetime.UTC).isoformat()
json.dump(p, open('.agent/profile.json', 'w'), indent=2)
print('Autonomy set to <LEVEL>')
"
```
Then clear the session cache: `rm -f /tmp/athanor_autonomy_*`
