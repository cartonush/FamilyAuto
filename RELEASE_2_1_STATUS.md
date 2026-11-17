# FamilyAuto 2.1 — Test release status

## Implemented and covered by automated tests
- Normal and instant active bookings can be ended early by the original renter or the house owner. Other members are denied by Firestore rules.
- Owner's forced return requires explicit confirmation and records `endedBy`; the reservation is removed from the shared schedule in the same Firestore transaction.
- The release action is shown on the home screen and booking list only to eligible users, and completed bookings are omitted from active calendar markings.
- The instant-use home popup offers a 24-hour default or a chosen end time with 15-minute increments and RTL-aligned hour/minute wheels.
- 2.1 UI version and PWA service-worker cache names updated.
- Duplicate home-release handler and duplicate `canRelease` declaration fixed.
- CI runs JavaScript syntax, booking-time regression, Cloudflare Worker smoke, and Firestore emulator rules tests.

## Implemented, but live operation is NOT yet verified
- **Early return:** requires the repository's current `firestore.rules` to be published to Firebase project `familyauto-s`. A GitHub merge alone does NOT deploy rules.
- FCM push notifications, Cloudflare Worker delivery and one-minute retry: real device delivery and recipient routing have not been verified.
- Ownership transfer via Cloudflare Worker: endpoint implemented and unit-tested; live authenticated transfer not verified.
- Activity history: UI and Worker audit logic exist; end-to-end live verification pending.
- Password reset delivery: Firebase Auth request exists; real email receipt unverified.
- 2.1 PWA on GitHub Pages: merge triggers hosting update, but actual iOS UI behavior must be tested.

## Not implemented or still blocked
- Secure free-backend implementation for permanent empty-house deletion and complete account deletion; existing UI references Firebase Cloud Functions that require Blaze deployment.
- Fully server-authoritative reservation conflict enforcement across all booking actions, beyond current client transactions and rules.
- End-to-end tests for simultaneous requests, two households, all permission roles and real iOS push behavior.
- Broader offline synchronization and multiple cars per household remain deferred.

## Test safely
1. Verify the home screen displays **גרסה 2.1 · בדיקה**.
2. Use a disposable test household with renter, owner and unrelated member.
3. Create a 6-hour booking, wait until its start, and end it early as renter. Check the schedule clears.
4. Repeat with the owner forcing a return; verify the unrelated member has no release control.
5. Publish the updated Firestore rules first; otherwise live early-return writes can be rejected.
6. Then test push notifications on iPhone installed as a Home Screen PWA.

Do not interpret green CI as proof of production deployment or real-device delivery.
