# FamilyAuto — PWA (development preview)

Hebrew RTL installable family-car booking application. Hosted on GitHub Pages and backed by Firebase project `familyauto-s`.

## Implemented in the repository
- Firebase email/password registration, login, logout and password reset.
- Registration form checks 12+ characters with letters and digits. **Enforce a matching password policy in Firebase Console; client-side validation alone is not security.**
- Per-user Firestore profile (display name and optional phone number). The phone number is **not** a login factor or SMS verification.
- Create houses, join via invitation code, approve members atomically, switch houses.
- Owner-managed member role (`user` / `authorized`) and temporary booking-request suspension.
- Ordinary members submit pending booking requests. Authorized members and the house owner create approved future reservations immediately in a Firestore transaction; instant car use is a separate permission. All reservations synchronize across household members.
- Members can cancel their own future approved non-instant reservations atomically, freeing the shared schedule.
- Owner can approve or reject pending requests. Approvals use a Firestore transaction and a shared schedule document to check for overlaps. The home screen and calendar consume the same live data.
- Responsive RTL layout, dark mode, PWA installation.

## Not yet production-ready
- **Booking approval is an experimental client-side transaction.** It checks overlaps atomically for ordinary clients, but Firestore security rules cannot yet independently verify all non-overlapping schedule entries. Do not rely on this preview for real car allocation.
- The older booking demo under Settings still uses localStorage and must not be mistaken for shared reservations.
- No offline request queue, push delivery, 7-day house recovery, account deletion, multi-car management, audit log, automated integration tests, or verified exact SwiftUI visual parity.
- The house membership/role UI still needs real multi-account browser integration testing. Emulator tests cover permission combinations but cannot validate live UI or deployed Firebase rules.
- Client-side password checks can be bypassed unless Firebase Auth password policy is configured.
- Do not rely on this preview for real car allocation.

## Required Firebase console step after code updates
The file `firestore.rules` is **not deployed automatically** by GitHub Pages.
1. Open [Firestore Rules](https://console.firebase.google.com/project/familyauto-s/firestore/databases/-default-/rules).
2. Copy the **complete** contents of [firestore.rules](./firestore.rules).
3. Replace existing rules, then **Publish**. This is required for v1.15 authorized direct booking; otherwise these transactions will be denied.
4. Verify a test account can save its own profile, create a house, request membership and submit a pending booking.
5. In a two-account test, submit a request as a member, approve as owner, confirm both devices display the same reservation, then try an overlapping request.
6. If the UI says `permission-denied`, the latest Firestore rules have not been published or the signed-in user is not a member of the active house.
7. Test with two accounts: member should not be able to change another user's role or access another house.

### Password policy
In Firebase Console → Authentication → Settings → Password policy, configure a strong policy to match the registration UI (minimum 12, letters and numbers). Availability and settings may vary.

### GitHub Pages
Settings → Pages → Deploy from a branch → main / root. iPhone: Safari → Share → Add to Home Screen.

## Planned security work
Server-authoritative overlap verification and tamper-proof approval invariants, per-house notification delivery, offline queue with explicit pending/sent states, recoverable deletion, comprehensive rule emulator and device tests.

No private credentials, Firebase Admin service account keys, or private VAPID keys should ever be committed.
