# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) frontend, FastAPI backend, PostgreSQL, MinIO (local S3-compatible) for photo storage. Hosts sign in with Google; guests join through an invitation without an account.

## Users

Guests and hosts at a real-world event (party, wedding, trip, meetup), on their phone, mid-event, often one-handed. The host creates the event; guests join by scanning a QR code or typing a short code and drop their photos into one shared album.

## Product Purpose

RollCall gives every event one shared photo roll. Success: a guest goes from scanning the QR to having their photos in the album in under a minute, and everyone can browse and save the full set afterwards.

## Positioning

One event, one code, one button to add photos. No feeds, no followers, no editing.

## Operating Context

- Used on mobile browsers first; desktop is secondary.
- Joining happens in person: host shows QR / code on their screen, guest scans with the camera app.
- Upload is batch: pick many photos from the gallery at once.

## Capabilities and Constraints

- Google sign-in is required to create and manage events. Guests open invitations directly into the album, with a persistent guest session on their browser.
- QR links use a long random invitation token. Short codes remain available for manual entry, with rate limiting.
- The host can pause new invitations, replace the invitation link, and pause photo uploads. Existing members keep album access.
- Event: title, description, start and end date/time, cover photo, join code + QR.
- Members can view and add photos, and save (download) originals.
- Deletion: a photo's author can delete their own photos; the event owner can delete any photo.
- Photos are stored as originals in S3 (MinIO locally).
- UI language: English.

## Brand Commitments

- Name: RollCall.
- Visual constraint set by the user: minimal black / white / gray, in the spirit of ChatGPT's interface; soft rounded corners; very thin light borders; mobile-app conventions.

## Product Principles

1. The upload button is the product. Everything else gets out of its way.
2. Joining must work from a cold QR scan with zero explanation.
   No sign-in, name form, or separate join confirmation for guests. The add-photos button opens the phone's file picker directly.
3. Photos are the only color on screen.
4. Never lose a photo: uploads report progress and failures plainly.

## Accessibility & Inclusion

44px minimum touch targets, WCAG AA contrast, respects reduced motion and system dark mode.
