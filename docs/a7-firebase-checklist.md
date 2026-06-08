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

> **Steps 1–4 are DONE** (completed via CLI 2026-06-08). Remaining: steps 5 and 7.

1. ~~Open https://console.firebase.google.com and click **Add project**.~~ ✅ Done — project `saoc-website` created on Blaze plan.
2. ~~Project name: `SAOC Website`. Project ID: `saoc-website`.~~ ✅ Done.
3. ~~Select the **InunuNet GCP billing account** (Blaze plan).~~ ✅ Done.
4. ~~Create App Hosting backend `saoc-main` in `us-central1`.~~ ✅ Done — URL: `https://saoc-main--saoc-website.us-central1.hosted.app`
5. **TODO — console only:** In Firebase console → App Hosting → backend `saoc-main` → **Connect repository**. Select `InunuNet/SAOC`, branch `main`. (Requires GitHub OAuth — cannot be done via CLI.)
6. ~~Note staging URL.~~ ✅ Done — see "Staging URL" section below.
7. **TODO — console only:** Go to **Project Settings → Service Accounts → Firebase Admin SDK → Generate new private key**. Download JSON. Extract `client_email` and `private_key` fields into `.env.local` (`FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY`).

## 3. Local Setup

> **`.env.local` already created** with all public Firebase values populated (2026-06-08).
> Still needed: `FIREBASE_ADMIN_CLIENT_EMAIL` + `FIREBASE_ADMIN_PRIVATE_KEY` from service account JSON (step 2.7).
> Still needed: `NEXT_PUBLIC_SANITY_PROJECT_ID` + Sanity tokens from sanity.io/manage.

```bash
# Firebase CLI already authenticated and project set to saoc-website
firebase projects:list  # verify saoc-website shows (current)
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

`https://saoc-main--saoc-website.us-central1.hosted.app`
