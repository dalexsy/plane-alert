# PlaneAlert

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.6.

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
