# PlaneAlert 🛩️

Real-time military and special aircraft tracking with background push notifications. Built with Angular 19 and Firebase Cloud Functions.

## 🚀 Quick Start

### Development

```bash
npm install
npm start
```

Opens the app at `http://localhost:4200/` with live reloading and a local proxy server.

### Deployment

```bash
# Deploy everything (frontend + backend)
npm run deploy:all

# Deploy only frontend to Surge
npm run deploy

# Deploy only backend to Firebase
npm run deploy:functions
```

## 📱 User Setup (Receiving Notifications)

1. **Visit** `https://plane-alert.surge.sh/?setup=pushover`
2. **Sign up** at [Pushover.net](https://pushover.net) (free)
3. **Enter** your Pushover User Key when prompted
4. **Set** your home location and preferred radius
5. **Receive** push notifications for military aircraft near you!

Notifications work even when your browser is closed, thanks to Firebase Cloud Functions running every 3 minutes.

## 🏗️ Project Structure

```
plane-alert/
├── src/                    # Angular frontend (Progressive Web App)
├── functions/              # Firebase Cloud Functions (backend)
│   └── src/
│       ├── services/       # Modular service layer
│       │   ├── aircraft-fetcher.ts
│       │   ├── image-fetcher.ts
│       │   ├── geocoding.ts
│       │   ├── notification-builder.ts
│       │   ├── notification-cooldown.ts
│       │   └── pushover-client.ts
│       └── notification-processor.ts
├── shared/                 # Shared TypeScript library
│   └── src/
│       ├── country-detection.ts
│       ├── military-detection.ts
│       ├── notification-formatter.ts
│       ├── geo-utils.ts
│       └── aircraft-db-loader.ts
└── scripts/                # Build and deployment scripts
```

### Shared Package

The `@plane-alert/shared` package contains logic used by both frontend and backend:

- **Country detection** from ICAO hex codes and registration prefixes
- **Military aircraft detection** with callsign patterns
- **Notification formatting** (single source of truth)
- **Geographic utilities** (distance, bearing calculations)
- **Aircraft database** lookup

## 🔧 Development

### Building Components

```bash
# Build frontend only
npm run build

# Build shared library (required before deploying functions)
cd shared && npm run build

# Build backend functions
cd functions && npm run build
```

### Running Tests

```bash
# Unit tests (single run, headless)
npm test

# Unit tests (watch mode)
npm run test:watch

# Test notification formatting
npm run tool:test:notification-title
npm run tool:test:notification-format

# Test helicopter detection
npm run tool:test:helicopter-detection

# Test operator matching
npm run tool:test:operator-matching

# Test pushover integration
npm run tool:test:pushover
```

### Syncing Aircraft Database

```bash
npm run sync:db
```

Merges user-contributed aircraft data from multiple sources.

## 🔔 Notification System

### Features

- **Concise Titles**: `[flag] [model]` or `[flag] [callsign]` (space-efficient)
- **Rich Context**: Location, bearing from user, aircraft heading, speed, altitude
- **Aircraft Images**: Automatically fetched from planespotters.net
- **Smart Cooldown**: Per-device, per-aircraft notification throttling
- **Geocoding**: Human-readable locations (e.g., "Potsdam, Brandenburg")

### Format Example

**Title**: `🇩🇪 Airbus A400M Atlas`  
**Body**: `over Brandenburg to the NW ↖ flying SE ↘ • 🇩🇪 GAF123 • Luftwaffe • 450 km/h • 8,500 m`

### Backend Architecture

The notification processor runs every 3 minutes via Firebase Cloud Scheduler:

1. **Fetch** devices from Firestore
2. **Query** ADS-B One API for nearby aircraft
3. **Filter** for military/special aircraft using shared detection logic
4. **Check** cooldown to avoid duplicate notifications
5. **Build** notification with geocoding and operator lookup
6. **Send** via Pushover API with aircraft image

All helper functions are modularized into services for better maintainability.

## 🌍 API Integrations

- **ADS-B One** - Real-time aircraft position data
- **Google Custom Search** - Aircraft image lookup
- **OpenStreetMap Nominatim** - Reverse geocoding
- **Pushover** - Cross-platform push notifications

## ⚙️ Configuration

### Environment Variables (Backend)

Create `functions/.env`:

```env
PUSHOVER_API_TOKEN=your_pushover_app_token
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

### Firebase Setup

The project is already configured for `plane-alert-800ff`. If you need to reconfigure:

1. Update `src/app/config/firebase.config.ts` with your project credentials
2. Update `.firebaserc` with your project ID
3. Enable Firestore, Cloud Functions, and Cloud Scheduler
4. Upgrade to Firebase Blaze plan (required for scheduled functions)

**You typically don't need to redo Firebase setup** unless you're creating a new project from scratch.

## 📝 Maintenance Notes

### Updating Shared Code

When modifying `shared/src/`, the deploy script automatically rebuilds and syncs to `functions/shared-package/`. Manual rebuild:

```bash
cd shared
npm run build
cd ..
npm run prepare:functions-shared
```

### Adding Service Modules

1. Create service in `functions/src/services/`
2. Import in `notification-processor.ts`
3. Keep functions focused and single-purpose

### Testing Locally

```bash
# Run functions emulator (optional)
cd functions
npm run serve
```

## 🐛 Troubleshooting

### Geocoding Timeouts

Disable geocoding in browser console:

```javascript
localStorage.setItem("disable-geocoding", "true");
location.reload();
```

### Firebase Deploy Fails

Ensure you're authenticated:

```bash
firebase login
firebase use plane-alert-800ff
```

### Shared Package Not Found

Reinstall local dependency:

```bash
cd functions
npm install
```

## 📚 Additional Resources

- [Angular CLI Documentation](https://angular.dev/tools/cli)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)
- [Pushover API](https://pushover.net/api)
- [ADS-B One API](https://api.adsb.one/)
