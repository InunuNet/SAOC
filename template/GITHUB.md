# GitHub Integration

Athanor uses GitHub for various tasks, such as:
- **`make update-template`**: Downloads the latest Athanor infrastructure from the GitHub repository.
- **`execution/get_repo_info.sh`**: Retrieves repository information.

To enable these features, you may need to provide a GitHub Personal Access Token (PAT).

## Setting up your GitHub Personal Access Token (PAT)

1.  **Generate a PAT**:
    - Go to your GitHub profile settings: `https://github.com/settings/tokens`
    - Click on "Generate new token" or "Generate new token (classic)".
    - Give your token a descriptive name (e.g., "Athanor Workspace").
    - **Crucially, grant the `repo` scope** (full control of private repositories) for Athanor to function correctly across different repository types.
    - Click "Generate token".
    - **Copy the token immediately.** You will not be able to see it again.

2.  **Add the PAT to your `.env` file**:
    - Open the `.env` file in your Athanor project root.
    - Uncomment the `GITHUB_TOKEN` line and replace `YOUR_PAT_HERE` with your newly generated token:
      ```
      GITHUB_TOKEN=ghp_YOUR_ACTUAL_TOKEN_GOES_HERE
      ```
    - Save the `.env` file.

3.  **Security Best Practices**:
    - Treat your PAT like a password.
    - Do not commit your `.env` file to version control (it's already in `.gitignore`).
    - If you suspect your token has been compromised, revoke it immediately from your GitHub settings.

Once your `GITHUB_TOKEN` is set, Athanor tools requiring GitHub access should function correctly.
