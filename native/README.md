# Hardy App for the App Store and Google Play

Hardy Hub stays a Vite/React website. This folder is the **native store packaging**: Capacitor wraps that same app as **Hardy App** for iPhone and Android.

You still edit and deploy the web app as before. Store builds copy `dist/` into Xcode and Android Studio projects.

## What this is (and is not)

- **Is:** the same family app, with a native shell, splash, icons, camera/mic/location permission strings, Universal Links, and passkeys that still use `hardyapp.co.uk`.
- **Is not:** a rewrite in Swift or Kotlin. Apple and Google still need a developer account, signing, screenshots and a review.

## One-time setup

1. Apple Developer Program and a Google Play Console account.
2. On a Mac: Xcode 16+, CocoaPods (`sudo gem install cocoapods`).
3. Android Studio Ladybug+ with JDK 21.
4. From the repo root:

```sh
npm i
python3 -m pip install --user pillow
npm run native:assets
npm run native:sync
npm run native:patch
```

5. Put your Apple Team ID in `native/store-identity.json` (`appleTeamId`) and the Play app signing SHA-256 in `androidSha256CertFingerprints`. Then run `npm run native:well-known` and deploy the website so `https://hardyapp.co.uk/.well-known/apple-app-site-association` and `assetlinks.json` go live. Passkeys and bank/Google logins need those files.

## iOS (App Store)

```sh
npm run native:ios
```

In Xcode:

1. Select the **App** target → Signing & Capabilities → your Team.
2. Confirm Associated Domains: `applinks:hardyapp.co.uk` and `webcredentials:hardyapp.co.uk`.
3. Product → Archive → Distribute App → App Store Connect.

Bundle ID is `uk.co.hardyapp.app`. Display name is **Hardy App**.

## Android (Play Store)

```sh
npm run native:android
```

In Android Studio: Build → Generate Signed Bundle / APK → Android App Bundle. Upload the `.aab` to Play Console.

Application ID is `uk.co.hardyapp.app`.

## After a web change

```sh
npm run native:sync
npm run native:patch
```

Then archive / bundle again. A website-only Firebase deploy does **not** update phones that installed the store app.

## Store listing notes

- Privacy: camera, microphone, photos, approximate/precise location, and Face ID are used for features that already exist in the web app.
- Encryption: `ITSAppUsesNonExemptEncryption` is set to `NO` (HTTPS only). Change this if you add custom crypto beyond TLS and the existing note/password vault.
- Push notifications in the store binary still need a Firebase iOS/Android app plus `GoogleService-Info.plist` / `google-services.json`. Until those files are added, in-app push stays on the web/PWA path.

## Identity

| Field | Value |
| --- | --- |
| Store name | Hardy App |
| Bundle / application ID | `uk.co.hardyapp.app` |
| URL scheme | `hardyapp://` |
| Website | https://hardyapp.co.uk |
