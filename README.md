# Air Mouse

Use your phone as a wireless mouse for your computer. Run **one app on your computer** (desktop); it starts the server and shows a pairing QR code. Scan with the Expo app on your phone to connect over your local network.

## How it works

Everything on your computer runs in **one process** (the desktop app):

- **Server** – Listens on a random port, serves the pairing page with QR code, and relays events between phone and desktop over Socket.IO.
- **Mouse control** – When your phone sends move/click/scroll, the same app moves the real mouse (via nut.js).

So you only run **desktop** on the PC; no separate “server” process. Phone and computer just need to be on the same network.

## Prerequisites

- **Node.js** 18+
- **Expo Go** on your phone (or a built app)
- Phone and computer on the same LAN

## Quick start

### 1. On your computer – start the desktop app

```bash
cd desktop
npm install
npm start
```

This will:

- Start the server on a **random port** (or set `PORT=3000` to fix it)
- Create a room and **open the pairing page in your browser** (QR code + room code)
- Connect itself as the “desktop” and move the mouse when the phone sends events

### 2. On your phone – open the Expo app

```bash
cd app
npm install
npx expo start
```

Then:

- **Option A:** Scan the QR code on the pairing page (in-app scanner or system camera; use the `airmouse://` link in Expo Go if prompted).
- **Option B:** Enter the server URL (e.g. `http://192.168.1.5:54321` – use the port printed by the desktop app) and the room code shown on the pairing page.

Once connected, use the phone as a touch pad: drag to move, tap to click, long-press for right-click, and use the scroll buttons.

## Project layout

```
AirMouse/
├── desktop/          # One app: server + pairing page + mouse control
│   ├── index.js
│   └── pair.html
├── app/              # Expo phone app (connect + mouse pad)
│   ├── app/
│   ├── components/
│   └── lib/
└── README.md
```

The `server/` folder is no longer used for the normal flow; the desktop app embeds the server.

## Configuration

- **Port:** Default is a random port (49152–65535). Set `PORT` to fix it: `PORT=3000 npm start` (in the `desktop` folder).
- The **QR code** always uses the current port (and your machine’s LAN IP when possible) so the phone connects to the right address.

## Building a standalone executable (desktop)

Using [pkg](https://github.com/vercel/pkg), you can build a single executable so others can run the desktop app without installing Node.js.

From the `desktop` folder:

```bash
npm install
npm run build
```

**`npm run build`** builds for the **current platform only** (e.g. on Windows you get `airmouse-desktop-win-x64.exe` in `dist/`). This avoids cross-compilation issues on Windows.

To build for a specific platform: `npm run build:win`, `npm run build:mac`, or `npm run build:linux`. To build all platforms at once (works best on macOS/Linux; can hit “spawn” errors on Windows), use `npm run build:all`.

Run the executable the same way as `node index.js` (it will pick a port and open the pairing page in your browser).

## Tech stack

- **Desktop:** Express, Socket.IO (server + client), QRCode, nut.js (mouse), open (browser)
- **App:** Expo, React Native Paper, expo-router, expo-camera, Socket.IO client

## Deep linking

The QR code encodes something like:

`airmouse://connect?server=http://192.168.1.5:54321&room=abc123`

The Expo app uses the `airmouse` scheme so scanning with the system camera can open the app and connect to that server and room.
