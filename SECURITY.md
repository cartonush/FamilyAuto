# Security and privacy

This is a public front-end prototype, **not a production service**. Local storage is device-specific and not a secure database. Do not enter personal information or depend on it for vehicle access.

Before enabling multi-user use: implement Firebase Auth, strict Firestore Security Rules with membership-based authorization, backend-enforced booking transactions, input validation, rate limits, least-privilege service credentials, audit logs, privacy and retention controls, and security tests. Never place Firebase Admin credentials or VAPID private keys in client files or GitHub. Firebase public web configuration is not an authorization boundary. Web Push requires explicit permission and supported installed/browser context.
