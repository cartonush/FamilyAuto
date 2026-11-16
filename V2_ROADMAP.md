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
- Added Firebase Cloud Function routing: pending -> owner only; approved -> household members except approving actor; rejected -> requester; cancelled/ended -> relevant members.
- Added callable Cloud Functions for owner transfer, sole-member house deletion and guarded account deletion.
- Added simple booking history page using current shared Firestore booking records.
- Added syntax checks for new JavaScript and rules tests for private push token storage.

## Required before live push test
1. Confirm Firebase project `familyauto-s` is on a plan that permits Cloud Functions deployment. Cloud Functions generally requires Blaze billing; do not enable billing without user approval.
2. Firebase Console -> Project settings -> Cloud Messaging -> Web Push certificates: create a Web Push key pair. Copy only the **public** VAPID key into `push-config.js`.
3. Deploy Cloud Functions and Firestore rules from the v2 branch with appropriate Firebase CLI access. GitHub Pages cannot run backend functions.
4. Test on Android/desktop first. On iPhone, install the PWA via Safari -> Add to Home Screen, launch from the Home Screen and grant notifications. Confirm FCM supports this browser/runtime in a live device test; if not, evaluate a standards-based Web Push alternative.
5. Verify notification recipients with all four test accounts and at least two devices. Test foreground, background, denied permission, logout and multiple homes.

## Required before 2.0 release
- Implement server-authoritative reservation operations for instant, direct, owner approval and cancellation. Client-only overlap checks are not a sufficient security boundary.
- Add immutable event history with action timestamps for rejection/cancellation, rather than only showing each booking's latest status.
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
