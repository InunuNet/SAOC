import os
import sys
import yaml
import subprocess

def get_ignored_paths():
    # Use git ls-files --ignored --others --directory to get ignored paths
    try:
        result = subprocess.run(
            ['git', 'ls-files', '--ignored', '--others', '--directory'],
            capture_output=True, text=True, check=True
        )
        return set(line.strip() for line in result.stdout.split('\n') if line.strip())
    except subprocess.CalledProcessError:
        return set()

def main():
    manifest_path = '.agent/update-manifest.yaml'
    if not os.path.exists(manifest_path):
        print(f"ERROR: Manifest not found at {manifest_path}")
        sys.exit(1)

    with open(manifest_path, 'r') as f:
        manifest = yaml.safe_load(f)

    manifest_paths = [item['path'] for item in manifest.get('paths', [])]
    
    # Get ignored files to filter out
    ignored = get_ignored_paths()

    missing = []
    
    # Check all top-level items
    for item in os.listdir('.'):
        if item == '.git':
            continue
            
        # Is it a directory?
        is_dir = os.path.isdir(item)
        name = item + '/' if is_dir else item
        
        # Check if ignored
        # git ls-files output sometimes doesn't have trailing slash for dirs or matches exactly
        if name in ignored or item in ignored or item + '/' in ignored:
            continue
            
        # If it's a file and ignored by git check-ignore
        try:
            ignore_check = subprocess.run(['git', 'check-ignore', '-q', item])
            if ignore_check.returncode == 0:
                continue
        except Exception:
            pass

        # Check if covered by manifest
        covered = False
        for mp in manifest_paths:
            if mp == name or mp.startswith(name) or name.startswith(mp):
                covered = True
                break
                
        if not covered:
            missing.append(name)
            
    if missing:
        missing.sort()
        print("ERROR: The following top-level paths are missing from .agent/update-manifest.yaml:")
        for m in missing:
            print(f"  - {m}")
        print("\nPlease classify them under HARNESS, WORKSPACE, DERIVED, or MERGE in .agent/update-manifest.yaml.")
        sys.exit(1)

if __name__ == '__main__':
    main()
