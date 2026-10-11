# FamilyAuto PWA

Installable Hebrew RTL prototype for family car scheduling.

## Current status
**Prototype only**: bookings are saved in this browser's localStorage. No login, real multi-device synchronization, push notifications, or server authorization yet. Do not enter sensitive information or rely on this prototype for real household bookings.

## Deploy
GitHub → Settings → Pages → Deploy from a branch → main / (root) → Save. GitHub Pages will serve the static PWA via HTTPS. On iPhone, open in Safari → Share → Add to Home Screen.

## Next phases
1. Firebase Authentication and household membership management.
2. Firestore real-time subscriptions and deny-by-default Security Rules with tests.
3. Trusted transactional booking validation and collision prevention.
4. Web Push subscriptions, server-side delivery, permissions and rate limits.
5. Privacy policy, account deletion, auditing, and end-to-end testing.

The SwiftUI version is reserved for later. Do not commit service-account credentials, private keys, or sensitive household data.