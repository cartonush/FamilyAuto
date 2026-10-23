# FamilyAuto technical audit — 2026-10-23

## Scope
Source-code review of the public GitHub Pages PWA. This is NOT a live Firebase integration test, multi-device test, responsive screenshot test, or a penetration test. Production readiness is **NO**.

## Verified by source inspection
- Firebase Auth initializes with public web config; login/register/logout/reset handlers exist.
- Homes use Firestore onSnapshot with a memberIds array-contains query.
- Firestore rules restrict house read to members and owner-managed house updates.
- Booking UI still uses localStorage; it is not house-scoped, server-synchronized or secure.
- Push notifications are not implemented.
- Owner and member are the only meaningful roles. Authorized driver, manager, approval policy, house switching persistence and vehicle permissions are not implemented.
- Service worker caches static files, but offline Firebase availability is not implemented.

## Bugs addressed in this audit
- Missing readableError function in firebase-homes.js could throw a ReferenceError inside catch blocks.
- Immediate selection of a newly created house before the snapshot arrived was inconsistent.
- CSS contained literal backslash-n before an auth selector.
- Added mobile overflow wrapping, minimum button tap height, safe-area bottom padding and dialog height constraint.

## Blocking issues
1. **No real bookings**: all booking creation and conflict detection is local-only; concurrent users can create overlapping bookings.
2. **No server-authoritative vehicle permissions**: roles and vehicle authorization are absent.
3. **Membership approval is not atomic**: owner adds UID to memberIds and separately marks request accepted; if the second write fails, state can diverge.
4. **Membership model is unbounded by request linkage**: owner can add arbitrary UIDs (owner has authority, but no auditable approval invariant).
5. **Invitation code is the Firestore document ID**: consider separate revocable invitations, expiry and brute-force protection before production.
6. **Pending join requests cannot be retried or cancelled** under current rules.
7. **House membership is not a separate profile record**; no detailed role, permission, audit trail or revocation handling.
8. **No server-side notification delivery**; FCM push and per-user subscriptions absent.
9. **No automated tests** for Firestore rules, race conditions, account switching or multi-user authorization.
10. **No original SwiftUI design source** available in this repository; exact visual parity cannot be confirmed.
11. **Auth account deletion and privacy controls** are absent.
12. **Firestore indexes** may be required for some queries; inspect Firebase console if failed-precondition appears.

## Required pre-release test matrix
- Devices: iPhone SE-sized, 13/15/17 Pro Max, Android narrow/wide, desktop; portrait and landscape, zoom and dynamic type.
- Accounts: signed-out, owner, manager, authorized member, non-authorized member, removed member.
- Multi-user: simultaneous requests, simultaneous approvals, overlapping times, offline/reconnect, multiple houses, cross-device refresh.
- Security: attempt to read/write another house, self-approve, change roles, spoof UID, bypass conflict checks, replay approval, remove owner.
- Notifications: permission denied, offline, token rotation, user removed from house, iOS Home Screen install.

## Next engineering milestone
Implement a typed Firestore model and emulator-tested rules for houses, memberships and booking requests, with atomic server-side approval transactions. Only after those tests should the local demo booking interface be replaced.
