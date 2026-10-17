# Electrical Systems Organizer

Offline mobile app for photovoltaic plant maintenance technicians. Given a DC
box (string box) number, it instantly answers which inverter and which
transformer station (CT) it belongs to — and, in a later version, which DC
box / inverter / CT / NCU a given panel row is connected to — without opening
the plant drawings one by one.

## How it works

- **This repository is only the app skeleton. It contains no plant data.**
- Each technician receives the plant data file manually and imports it inside
  the app (Data tab). The data is stored locally on the device and never
  leaves it. See [docs/DATA_FORMAT.md](docs/DATA_FORMAT.md).
- The app is fully offline: no server, no network calls, no accounts.

## Usage

The app (UI name: **GridScope**) opens on a home screen with one card per
feature:

- **Plant Explorer** — pick a CT, see all its inverters and DC boxes
  color-coded. Tap a DC box and its inverter lights up (everything else dims);
  tap an inverter and all its DC boxes light up. A banner shows the full
  chain (box → inverter → CT).
- **Quick Search** — type `25` (every DC box 25 with its inverter and CT),
  `8 25` (box 25 of CT 8 only), or `8.3` (all boxes of inverter 8.3).
- **Documents** — store the plant PDFs on the device (added via file picker,
  never bundled with the app), open them, save them back to phone storage, or
  delete them.
- **Row Finder** — coming with the row-mapping data (schema v2).
- **Data** — import the data file, export a backup copy, or wipe the device.

## Development

The app is plain HTML/CSS/JS in [www/](www/) with no build step — open
`www/index.html` in a browser to develop and test. For phones it is packaged
as a sideloaded Android APK (Capacitor wrapper, to be added), so no app store
is required. Signing keys and data files are excluded via `.gitignore` and
must never be committed.
