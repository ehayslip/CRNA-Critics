# CRNA Critics phone apps (iOS + Android)

The apps are a [Capacitor](https://capacitorjs.com) shell around the live site at
https://crnacritics.com. Every change to the website shows up in the apps right away. Store
updates are only needed when something in this `mobile/` folder changes.

- App name: **CRNA Critics**, ID `com.crnacritics.app` (same on both stores)
- The app adds `CRNACriticsApp` to its user agent. The website uses that to hide the
  "Get the app" band when someone is already in the app.
- `www/offline.html` is the screen shown when the phone has no signal.
- Icons and splash screens are generated from `assets/` with `npm run assets`.

## Builds without a computer (GitHub Actions)

Go to **Actions → Mobile apps → Run workflow**. When the run finishes:

- **Android:** download `crna-critics-android-test-apk`. It installs on any Android phone
  (allow "install unknown apps"). Once the signing secrets below are set, the same run also
  produces `crna-critics-android-play-bundle`, which is the `.aab` file you upload to Google Play.
- **iOS:** the run proves the iPhone app compiles. Sending it to the App Store needs the Apple
  steps below.

## Google Play (Android)

1. Create a Google Play Console account ($25, one-time) at https://play.google.com/console.
   You can sign up as an organization under Medcrisis Anesthesia LLC (that needs a D-U-N-S
   number). New *personal* accounts must run a 14-day closed test with 12 testers before
   going public.
2. Make an upload key one time (on any computer with Java):
   `keytool -genkeypair -v -keystore release.keystore -alias crnacritics -keyalg RSA -keysize 2048 -validity 10000`
   Keep this file and its password safe. Every future update must be signed with it.
3. In GitHub, go to repo **Settings → Secrets and variables → Actions** and add:
   `ANDROID_KEYSTORE_BASE64` (output of `base64 -i release.keystore`), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` (`crnacritics`) and `ANDROID_KEY_PASSWORD`.
4. Run the workflow, download the `.aab`, create the app in Play Console and upload it.
5. When the listing is live, set **`ANDROID_APP_URL`** in Railway to
   `https://play.google.com/store/apps/details?id=com.crnacritics.app`.

## Apple App Store (iOS)

1. Join the Apple Developer Program ($99/year) at https://developer.apple.com/programs/.
   Enroll as an organization (Medcrisis Anesthesia LLC, needs a D-U-N-S number) so the store
   shows the company name instead of your personal name.
2. Building for the store needs a Mac with Xcode: `cd mobile && npm ci && npm run ios`.
   Then, in Xcode, pick your team under Signing and choose **Product → Archive → Distribute**.
   If you don't have a Mac, a cloud build service (Ionic Appflow, Codemagic) can archive it
   from this repo with your Apple account.
3. In App Store Connect, add a privacy policy URL, screenshots, and a **demo reviewer account**.
   The site is members-only, so Apple's reviewer can't see anything without a login.
4. When it's approved, set **`IOS_APP_URL`** in Railway to the app's
   `https://apps.apple.com/app/id…` link.

**Heads-up on Apple review:** Apple sometimes rejects apps that are "just a website"
(guideline 4.2). The offline screen, native splash, and icon help, and a members-only review
community usually passes. If it does get rejected, the usual fix is adding push notifications
(new reviews, messages), and Capacitor supports those.

## Home page download buttons

The "Get the app" band on the home page reads `IOS_APP_URL` and `ANDROID_APP_URL` from Railway
(via `/api/app-links`). If a variable is blank, that button shows "Coming soon". Once it's set,
the button goes live with no code change. `crnacritics.com/app` is one shareable link that
sends iPhones to the App Store and Android phones to Google Play.
