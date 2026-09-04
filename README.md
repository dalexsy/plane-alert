# PlaneAlert

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.6.

## Antenna sightings

Tracker of every unique aircraft the home ADS-B antenna has seen.

- **Open:** [https://planes.dryl.io/sightings](https://planes.dryl.io/sightings) (map toolbar: cell-tower icon). Kiosk stays on the map.
- **Feed:** `http://192.168.178.27/tar1090/data/aircraft.json` (tar1090 UI: `http://192.168.178.27/tar1090/`).
- **Poller:** `planes-api` on dryl-prod (`.79`) reads the feed every 12s and upserts by ICAO hex. Does not run on a laptop.
- **Store:** `/home/pi/planes-api/data/antenna-sightings.json` on dryl-prod.

Point the feed (optional, in `/home/pi/planes-api/.env` — never overwrite that file from a laptop):

```
PLANES_ANTENNA_FEED_URL=http://192.168.178.27/tar1090/data/aircraft.json
PLANES_ANTENNA_POLL_MS=12000
PLANES_ANTENNA_SIGHTINGS_PATH=/home/pi/planes-api/data/antenna-sightings.json
PLANES_ANTENNA_ENABLED=1
```

Set `PLANES_ANTENNA_ENABLED=0` to pause the poller. Defaults match the home tar1090 URL above if unset.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.
BRUJO02

## Geocoding (Address Lookup)

The app uses geocoding services to convert coordinates to human-readable addresses. If you encounter 504 Gateway Timeout errors:

### Quick Fix

```javascript
// In browser console, disable geocoding:
localStorage.setItem("disable-geocoding", "true");
location.reload();
```

### What This Does

### Re-enable Geocoding

```javascript
localStorage.removeItem("disable-geocoding");
location.reload();
```

### Alternative Solutions

## Background notifications (Firebase Cloud Functions)

This repo now contains a minimal Firebase Functions project in the `functions/` folder. It stores device push tokens in Firestore and pings the ADS-B feed every few minutes to send background alerts.

### Setup for New Devices

**Quick Setup URL**: Open `https://planes.dryl.io/?setup=pushover` on any device to be prompted for your Pushover User Key.

1. Sign up at [Pushover.net](https://pushover.net) (free)
2. Find your User Key on your dashboard
3. Visit `https://planes.dryl.io/?setup=pushover` on your device
4. Enter your User Key when prompted
5. Set your home location in the app
6. You'll receive push notifications for aircraft near your location!

### Cloud Function Deployment

1. Install the Firebase CLI if you have not already:
   ```bash
   npm install -g firebase-tools
   ```
2. Configure the functions project:
   ```bash
   cd functions
   npm install
   ```
3. Make sure the active Firebase project is `plane-alert-800ff` (or update the IDs in `src/app/config/firebase.config.ts` if you renamed it). Cloud Scheduler triggers require the Blaze plan.
4. Deploy the functions:
   ```bash
   firebase deploy --only functions
   ```

Once deployed, the web app automatically POSTs each browser's FCM token, home location, radius, and distance units to the HTTPS endpoint. The scheduled function polls ADS-B data, filters for likely military flights, and pushes notifications even when the PWA is closed. Tokens are removed automatically if Firebase reports them as invalid.

### Notification Features

- **Follow Aircraft**: Click "View on Map" in push notifications to automatically center and follow the aircraft
- **Military & Special Aircraft**: Automatic detection of military callsigns and special ICAO codes
- **Customizable Alerts**: Set your own home location and radius
- **Cross-Platform**: Works on Android, iOS, and Desktop via Pushover

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
