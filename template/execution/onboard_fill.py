import json
import sys
import os
import re

def update_onboard_placeholders():
    profile_path = '.agent/profile.json'
    if not os.path.exists(profile_path):
        print(f"Error: {profile_path} not found.", file=sys.stderr)
        return

    with open(profile_path, 'r') as f:
        profile = json.load(f)

    identity = profile.get('identity', {})
    agent_name = identity.get('agent_name')
    project_role = identity.get('project_role')

    if not agent_name or not project_role:
        # Fallback to top-level if exists (legacy)
        agent_name = agent_name or profile.get('agent_name')
        project_role = project_role or profile.get('project_role')

    if not agent_name or not project_role:
        if len(sys.argv) < 3:
            print("Usage: python3 execution/onboard_fill.py <agent_name> <project_role>", file=sys.stderr)
            return
        agent_name = sys.argv[1]
        project_role = sys.argv[2]

    agents_md_path = 'AGENTS.md'
    if not os.path.exists(agents_md_path):
        print(f"Error: {agents_md_path} not found.", file=sys.stderr)
        return

    with open(agents_md_path, 'r') as f:
        content = f.read()

    # Strategy: Replace {{AGENT_NAME}} and {{PROJECT_ROLE}}
    new_content = content.replace('{{AGENT_NAME}}', agent_name)
    new_content = new_content.replace('{{PROJECT_ROLE}}', project_role)
    
    # Regex for re-filling if already filled - this is now just for stdout, not writing
    pattern = r'\*\*You are .+\*\* — the .+ and primary agent\.'
    replacement = f'**You are {agent_name}** — the {project_role} and primary agent.'
    
    new_content = re.sub(pattern, replacement, new_content)

    print(new_content)

if __name__ == "__main__":
    update_onboard_placeholders()
