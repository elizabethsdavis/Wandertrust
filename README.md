# PackPal

A luxury, ADHD-friendly personal packing assistant — trained on 22 real trips.

## Run it

```bash
npm install
npm run dev
```

With no configuration, PackPal runs fully offline (data saved in your browser).

## Accounts & cloud sync

PackPal supports phone-number sign-in (SMS OTP), passkeys (Face ID / Touch ID),
and multi-device cloud sync via Firebase. To turn it on, follow **[SETUP.md](SETUP.md)**.

Until you add the Firebase keys, the app stays in offline/local mode — nothing
breaks, there's just no login.
