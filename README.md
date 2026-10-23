# FamilyAuto — PWA (development preview)

Hebrew RTL installable family-car booking application. Hosted on GitHub Pages and backed by Firebase project `familyauto-s`.

## Implemented in the repository
- Firebase email/password registration, login, logout and password reset.
- Registration form checks 12+ characters with letters and digits. **Enforce a matching password policy in Firebase Console; client-side validation alone is not security.**
- Per-user Firestore profile (display name and optional phone number). The phone number is **not** a login factor or SMS verification.
- Create houses, join via invitation code, approve members atomically, switch houses.
- Owner-managed member role (`user` / `authorized`) and temporary booking-request suspension.
- Pending booking requests in Firestore, scoped to a house and user, with real-time subscriptions and user cancellation.
- Responsive RTL layout, dark mode, PWA installation.

## Not yet production-ready
- **No server-authoritative booking approvals or collision prevention.** The new Firestore request flow stores only `pending` requests; it deliberately does not approve or reserve the car.
- The older booking demo in the UI still uses localStorage and must not be mistaken for real shared reservations.
- No offline request queue, push delivery, 7-day house recovery, account deletion, multi-car management, audit log, automated integration tests, or verified exact SwiftUI visual parity.
- The house membership/role UI needs multi-account integration testing and rule emulator tests.
- Client-side password checks can be bypassed unless Firebase Auth password policy is configured.
- Do not rely on this preview for real car allocation.

## Required Firebase console step after code updates
The file `firestore.rules` is **not deployed automatically** by GitHub Pages.
1. Open [Firestore Rules](https://console.firebase.google.com/project/familyauto-s/firestore/databases/-default-/rules).
2. Copy the **complete** contents of [firestore.rules](./firestore.rules).
3. Replace existing rules, then **Publish**.
4. Verify a test account can save its own profile, create a house, request membership and submit a pending booking.
5. Test with two accounts: member should not be able to change another user's role or access another house.

### Password policy
In Firebase Console → Authentication → Settings → Password policy, configure a strong policy to match the registration UI (minimum 12, letters and numbers). Availability and settings may vary.

### GitHub Pages
Settings → Pages → Deploy from a branch → main / root. iPhone: Safari → Share → Add to Home Screen.

## Planned security work
Transactional server-authoritative booking approvals, permission checks on every write, overlap protection under concurrency, per-house notification delivery, offline queue with explicit pending/sent states, recoverable deletion, comprehensive rule emulator and device tests.

No private credentials, Firebase Admin service account keys, or private VAPID keys should ever be committed.
