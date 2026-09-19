# Hardy Hub

Private family app at [hardyapp.co.uk](https://hardyapp.co.uk). Vite, React, TypeScript, Tailwind, Firebase.

## Web app

```sh
npm i
npm run dev
```

The dev server is http://localhost:8080. Production deploys with Firebase Hosting.

## Phone app (App Store / Google Play)

The same codebase ships as **Hardy App** through Capacitor. Native projects live in `ios/` and `android/`.

```sh
npm run native:sync
npm run native:ios      # Mac + Xcode
npm run native:android  # Android Studio
```

Step-by-step signing, associated domains, and store listing notes: [native/README.md](native/README.md).

## Tests

```sh
npm test
```
