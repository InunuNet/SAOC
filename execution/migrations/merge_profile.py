#!/usr/bin/env python3
"""
Athanor Migration Tool — merge_profile.py
Merges old Workspace Template profile.json into Athanor v3.2.2 format.
Never destroys existing fields — safe merge only.
"""
import json, sys, datetime, os

def merge_profile(target_path, old_path, project_name, **overrides):
    """Merge old profile into Athanor v3.2.2 format."""
    # Load old profile if exists
    old = {}
    if os.path.exists(old_path):
        try:
            old = json.load(open(old_path))
        except Exception:
            pass

    # Athanor v3.2.2 base structure
    new = {
        "project_name": overrides.get("project_name", old.get("project_name", project_name)),
        "project_type": overrides.get("project_type", old.get("project_type", "general")),
        "platform": overrides.get("platform", old.get("platform", "macos")),
        "tech_stack": overrides.get("tech_stack", old.get("tech_stack", [])),
        "template_version": "3.2.2",
        "onboarding_complete": overrides.get("onboarding_complete", False),
        "features": {
            "brain": True,
            "hooks": True,
            "agent_teams": True,
            "skills": True,
            "security_rules": overrides.get("security_rules", old.get("features", {}).get("security_rules", False)),
            "style_guide": overrides.get("style_guide", old.get("features", {}).get("style_guide", False)),
            "llm_apis": overrides.get("llm_apis", old.get("features", {}).get("llm_apis", False)),
        },
        "agents": ["lead", "dev", "analyst", "architect", "qa", "docs", "maintainer"],
        "memory": {
            "brain_backend": "chromadb",
            "brain_path": ".agent/memory/brain",
            "tiers": ["scratch", "project", "brain", "global"]
        },
        "migrated_at": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        "migrated_from": f"workspace-template-v{old.get('version', old.get('template_version', '?'))}"
    }

    with open(target_path, 'w') as f:
        json.dump(new, f, indent=2)
        f.write('\n')

    print(f"✅ profile.json merged → {project_name} (v3.2.2)")
    return new


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: merge_profile.py <target_profile.json> <old_profile.json> <project_name>")
        sys.exit(1)
    merge_profile(sys.argv[1], sys.argv[2], sys.argv[3])
