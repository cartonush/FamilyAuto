# FamilyAuto 2.0 — Development checklist (NOT released)

This work is intentionally isolated on the `feature/familyauto-v2` branch. The deployed GitHub Pages app remains v1.15 until the v2 work is tested and merged.

## Scope agreed
- Repair existing bugs, password reset delivery and version labels.
- Role-relevant push notifications using Firebase Cloud Messaging.
- Transfer ownership of every owned house before account deletion; permanently delete a house if its owner is its only member.
- Account deletion with password reauthentication, anonymized historical booking display names and preserved schedule consistency.
- Simple activity history of booking request, approval, reserved time, user and completion.
- Strengthen booking security. Do not release until server-authoritative collision checks are implemented.
- Preserve existing Hebrew RTL visual design and styling.

Deferred: offline queue, multiple cars per house, expanded automated browser tests.

## Completed on branch (not deployed)
- Corrected member join approval to include `canTakeCar:false` required by the rules.
- Removed stale 1.9 label from booking screen.
- Added push opt-in controls in Account Settings, per-device FCM token storage and private Firestore rules.
- Added background and foreground notification handlers in existing PWA service worker.
- Added Cloudflare Worker notification routing and Firebase Auth verification: pending -> owner only; approved -> household members except approving actor; rejected -> requester; cancelled/ended -> relevant members. The Worker reads a Firestore notification outbox, dispatches via FCM and has a one-minute scheduled retry. The GitHub Pages PWA remains on its original URL.
- Added a configured Worker endpoint (`https://familyauto.roisuissa6.workers.dev`) to the v2 client queue. Cloudflare reports a Ready deployment, but authenticated push delivery has not yet been tested.
- Kept Firebase Cloud Functions implementations for account ownership transfer/deletion and activity logging as separate, not-yet-deployable items on Spark.
- Added callable Cloud Functions for owner transfer, sole-member house deletion and guarded account deletion.
- Added immutable Cloud Function activity events for request creation, approval, rejection, cancellation and end-of-use; added activity history page with fallback for bookings created before v2. The free Cloudflare Worker now also records deterministic append-only activity entries from queued booking notifications (with separate unit tests), so the activity page does not require Blaze when the notification queue is functioning.
- Added syntax checks for new JavaScript and rules tests for private push token storage.
- Added push-token cleanup before logout/account deletion, persisted opt-in state on the device, and clearly labeled 2.0-preview app shell/cache on the feature branch. No production deployment yet.
- Added PR-triggered CI checks and isolated Worker activity-history tests.
- Added atomic ownership transfer via Cloudflare Worker with Firebase ID-token verification and Firestore write preconditions; v2 UI now calls this endpoint instead of the undeployed Firebase callable. Unit tests cover owner authorization and atomic updates.

## Required before live push test
1. Firebase project `familyauto-s` remains on Spark; Cloudflare Worker is the selected free notification backend. The public VAPID key is configured in `push-config.js`.
2. Cloudflare Worker is deployed at `https://familyauto.roisuissa6.workers.dev`. The user configured a service-account JSON as a Cloudflare runtime Secret. Verify `/health`, authenticated Firestore/FCM permissions, scheduled cron runs and notification-delivery logs without exposing credentials.
3. Run and pass CI security-rule and Worker smoke tests. Deploy v2 Firestore rules carefully, checking v1.15 compatibility before any production rules change.
4. The v2 PWA client is not on GitHub Pages `main` yet. Test push in a controlled release/preview with authenticated test users; never claim live push works from Cloudflare's Ready status alone.
5. On iPhone, install the PWA via Safari -> Add to Home Screen, launch from the Home Screen and grant notifications. Confirm FCM supports this browser/runtime in a live device test; if not, evaluate a standards-based Web Push alternative.
6. Verify notification recipients with all four test accounts and at least two devices. Test foreground, background, denied permission, logout and multiple homes.
7. Ownership transfer has a Cloudflare Worker implementation but needs live deployment and testing. Permanent house deletion and account deletion still use undeployed Firebase Cloud Functions; either implement and validate a free secure backend alternative or obtain explicit consent for Blaze billing. Do not silently deploy billing-dependent features. Activity history has a Cloudflare alternative, pending live validation.

## Required before 2.0 release
- Implement server-authoritative reservation operations for instant, direct, owner approval and cancellation. Client-only overlap checks are not a sufficient security boundary.
- Validate activity event history on real Firebase devices, including timestamps and historic records created before v2.
- Confirm account deletion handles pending join requests in other houses and anonymizes all historical personal fields, including future activity records.
- Test owner transfer, permanent house deletion, account deletion and password reset end-to-end.
- Verify new Cloud Functions in emulator and on test accounts.
- Revisit iOS push compatibility and clean up stale FCM tokens on signout/account switch.
- Merge to main, bump visible version and service-worker cache to 2.0, deploy backend and test live before calling the release complete.

## Security notes
- The public Firebase web API key and public VAPID key are not Admin SDK secrets.
- Never commit service-account credentials or private push keys.
- The server chooses notification recipients from trusted Firestore house membership, not from a client-supplied list.
- Firebase Auth account deletion is irreversible. Historical booking schedule data is retained to avoid corrupting shared household reservations.
