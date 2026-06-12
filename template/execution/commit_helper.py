import subprocess
import sys

def run_cmd(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()

def main():
    print("📦 Staging changes...")
    run_cmd("git add .")

    if len(sys.argv) > 2:
        commit_type = sys.argv[1]
        msg = " ".join(sys.argv[2:])
        full_msg = f"{commit_type}: {msg}"
        run_cmd(f'git commit -m "{full_msg}"')
        print(f"✅ Committed: {full_msg}")
    else:
        print("\n[Semantic Commit Helper]")
        print("Usage: make commit TYPE=<type> MSG=\"<message>\"")
        print("\nValid Types:")
        print("  feat:     A new feature")
        print("  fix:      A bug fix")
        print("  refactor: Code restructuring without feature addition")
        print("  docs:     Documentation only")
        print("  chore:    Maintenance / config updates")
        print("  test:     Adding tests")
        run_cmd("git reset") # Unstage if aborted/invalid
        sys.exit(1)

if __name__ == "__main__":
    main()
