# Nani vs Tantrik 3D

First-person 3D stealth horror. You are Nani, trapped in a haunted haveli with a Tantrik. Works on desktop browsers and phones (touch controls), and can be built into an Android app.

## Play in a browser (desktop)
1. Download https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js and save it as `www/three.min.js` (optional; without it the game loads Three.js from the internet).
2. In VS Code, install the **Live Server** extension, right-click `www/index.html` -> *Open with Live Server*.

## Put it online + play on any phone (GitHub Pages)
```
git init
git add .
git commit -m "Nani vs Tantrik 3D"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
Then on GitHub: repo -> Settings -> Pages -> Source: **GitHub Actions**. The included `pages.yml` deploys the game; your link appears in the Actions run. Open it on your phone and use "Add to Home Screen" for a full-screen feel.

## Build a real Android app (APK) with GitHub
This repo already has `.github/workflows/android.yml`. After you push:
1. GitHub -> **Actions** tab -> *Build Android APK* -> wait ~5 minutes.
2. Open the finished run -> **Artifacts** -> download `nani-vs-tantrik-apk`, unzip, send `app-debug.apk` to your phone and install it (allow "install unknown apps").
3. Change `appId` in `capacitor.config.json` to your own (e.g. `com.yourname.nani`).

For the Google Play Store you need a signed release build and a Play developer account. iOS needs a Mac with Xcode (`npx cap add ios`).

## Controls
Desktop: WASD move, mouse look (click to capture), Shift run (loud), C crouch (silent), E hide, Q or click EYE button.
Phone: left thumb joystick (push to the edge = run), right thumb look, HIDE / CROUCH / EYE buttons.

## Tweak difficulty
Edit `CFG` at the top of `www/game.js`: eye time, hearts, speeds, hearing/sight ranges, stages.
