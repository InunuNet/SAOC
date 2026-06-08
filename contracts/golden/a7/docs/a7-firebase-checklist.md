# A7 — Firebase Provisioning Checklist (InunuNet GCP Account)

This feature has both a scaffolded code component (handled by @dev) and a manual provisioning component (Brad must perform in the Firebase/GCP console). Follow this checklist in order.

## 1. Prerequisites

- Firebase CLI installed globally:
  ```bash
  npm install -g firebase-tools
  ```
- Logged into the InunuNet Google account:
  ```bash
  firebase login
  ```
- Confirm you are on the correct account:
  ```bash
  firebase login:list
  ```

## 2. Console Steps (Brad — manual)

1. Open https://console.firebase.google.com and click **Add project**.
2. Project name: `SAOC Website`. Project ID: `saoc-website` (must match `.firebaserc`).
3. When prompted, select the **InunuNet GCP billing account**. The **Blaze (pay-as-you-go) plan is required** for App Hosting.
4. In the Firebase console sidebar, choose **Build → App Hosting → Get started**.
5. Connect GitHub: select repo `InunuNet/SAOC`, branch `main`. Allow the GitHub App to access the repo.
6. Note the **staging URL** displayed after backend creation (e.g. `https://saoc-website--<hash>.web.app`). Save it to `docs/a7-firebase-checklist.md` under "Staging URL".
7. Go to **Project Settings → Service Accounts → Firebase Admin SDK → Generate new private key**. Download the JSON file and store it securely (do NOT commit). You will paste fields from this JSON into `.env.local`.

## 3. Local Setup

```bash
cp .env.local.example .env.local
# Fill in values from Firebase console (Project Settings → General → Your apps)
# and from the service-account JSON downloaded in step 2.7.
# Sanity values come from sanity.io/manage.

firebase login
firebase use saoc-website
```

Verify the project link:
```bash
firebase projects:list
```

## 4. Secrets (run from project root)

App Hosting injects these at build/runtime via Secret Manager:

```bash
firebase apphosting:secrets:set SANITY_API_TOKEN --project saoc-website
firebase apphosting:secrets:set SANITY_REVALIDATE_SECRET --project saoc-website
```

Paste each secret when prompted. Grant access to the App Hosting service account when asked.

## 5. Verification

- Curl the staging URL:
  ```bash
  curl -I https://<your-staging-url>
  ```
  Expect HTTP/2 200.
- Check the Firebase console → App Hosting → Backend status is **Active**.
- Confirm the latest commit on `main` shows in the rollout history.

## 6. Post-Provisioning

- Update `docs/a7-firebase-checklist.md` with the actual staging URL.
- Mark A7 done in `.agent/memory/project/backlog.md` (or equivalent).
- Push the branch; confirm App Hosting auto-deploys the next commit on `main`.
- Move on to A8 / next mission.

## Staging URL

`<fill in after step 2.6>`
