# NoAds Athan for iPhone — your steps, in order

The app itself is ready (this folder). iPhones can't install apps from a
link or a file, so your app has to go through Apple's own system. Apple
only builds iPhone apps on Mac computers — you don't need to own one:
a service called **Codemagic** rents us a cloud Mac that builds the app
and sends it to Apple's **TestFlight**, where you and your friends can
install it.

Everything below can be done from your phone's browser. Take it one
step at a time — there is no rush, and steps 1–2 are Apple's waiting
times, not work.

**Money involved:** Apple charges **$99 (US) per year** for the
developer account. Codemagic's free plan is enough to start.

---

## Step 1 — Join the Apple Developer Program  *(only you can do this)*

1. Go to **developer.apple.com** → **Account** → sign in with an Apple ID
   (create a free Apple ID first if you don't have one).
2. Choose **Enroll** and enroll as an **Individual**.
3. Pay the **$99/year** membership with your card.
4. Apple checks your identity — this can take **1–2 days**. You'll get
   an email when you're in.

> Only you can do this step: it's your name, your ID and your card.

## Step 2 — Create the app's home in App Store Connect  *(only you)*

1. Go to **appstoreconnect.apple.com** → **My Apps** → **+** → **New App**.
2. Platform: **iOS**. Name: **NoAds Athan**. Primary language: English.
3. Bundle ID: **com.housseyn.noadsathan** (if it's not in the list yet,
   pick "register a new one" style option with exactly that ID).
4. SKU: write anything, e.g. `noads-athan-1`. Create.

## Step 3 — Create the App Store Connect API key  *(only you — be careful)*

This key is what lets Codemagic sign and upload the app for you.

1. In **App Store Connect** → **Users and Access** → **Integrations**
   tab → **App Store Connect API** → **Team Keys** → **+** (Generate API Key).
2. Name: `Codemagic`. Role: **App Manager**. Generate.
3. **Download the `.p8` file — you can download it only ONCE.** If you
   lose it, you must delete the key and make a new one.
4. Note the **Key ID** shown next to it, and the **Issuer ID** shown at
   the top of that page. You'll need all three in Step 4.

> ⚠️ **Keep the `.p8` file safe and private.** Never send it — or your
> Apple password, or any sign-in code — in a chat, to me, or to anyone.
> You will paste it only into Codemagic's own website in Step 4.

## Step 4 — Create the Codemagic account and connect everything

1. Go to **codemagic.io** and sign up (free).
2. Add this project: **Add application** and connect the project files
   (when we're ready, we'll put this folder on GitHub together and
   connect that — Codemagic reads the `codemagic.yaml` file in it
   automatically).
3. In Codemagic: **Team settings → Environment variables** (or the app's
   environment variable settings) → create a **group named exactly
   `app_store_connect`** with these three variables, using the values
   from Step 3:
   - `APP_STORE_CONNECT_ISSUER_ID` — the Issuer ID
   - `APP_STORE_CONNECT_KEY_IDENTIFIER` — the Key ID
   - `APP_STORE_CONNECT_PRIVATE_KEY` — the full contents of the `.p8`
     file (open it, copy everything, paste). Mark it **secure/encrypted**.
4. Start the build: open the app in Codemagic → **Start new build** →
   workflow **"NoAds Athan iOS — TestFlight"**.

Codemagic's Mac builds the app, signs it with your key, and uploads it
to TestFlight automatically. The first build is the real test of the
whole chain — if anything fails, the build log says why, and we fix it
and run it again.

## Step 5 — Test it and share with friends (TestFlight)

1. Install Apple's free **TestFlight** app on the iPhone.
2. In **App Store Connect → your app → TestFlight**, your build appears
   after Apple processes it (usually under an hour).
3. Add testers: **External Testing** → create a group → add your
   friends' email addresses (or turn on the public link and just send
   them the link). The first external build goes through a quick Apple
   beta review, then your friends get an email invite.
4. They install TestFlight, tap the invite, and install NoAds Athan.

## What to expect on iPhone (Apple's rules, not ours)

- When the app is closed, the athan arrives as a **notification that
  plays about 29 seconds of the athan** — Apple does not allow any app
  to play longer sounds in the background. Inside the app, everything
  works like Android.
- For the notifications to be scheduled, open the app and **Allow**
  notifications when it asks.

## Later (when you're happy with the tests)

From App Store Connect you can submit the app for Apple's full review
to release it on the App Store for everyone. That's a separate,
manual step — nothing is released automatically.

---

### Who does what — summary

| Step | Who |
|---|---|
| Developer Program ($99/yr, ID check) | **You only** |
| App record in App Store Connect | **You only** |
| API key (.p8) creation | **You only** — keep it secret |
| Pasting the key into Codemagic | **You only** (on Codemagic's site) |
| The app, the build file (`codemagic.yaml`), fixes | **Muse** |
| Running builds, adding testers | You (one tap each) |
