# Functions Architecture

## Shared Code

**IMPORTANT**: The shared code lives in the `../shared` directory as a TypeScript package (`@plane-alert/shared`).

### DO NOT:

- ❌ Create or edit files in `functions/src/shared/`
- ❌ Copy shared code into the functions directory
- ❌ Import from `'./shared'` in function files

### DO:

- ✅ Edit shared code in `../shared/src/`
- ✅ Import from `'@plane-alert/shared'` in function files
- ✅ Run `npm run build` in the `../shared` directory after changes
- ✅ The functions will automatically use the latest compiled version

## Workflow for Shared Code Changes

1. **Edit** source files in `../shared/src/`
2. **Build** the shared package: `cd ../shared && npm run build`
3. **Build** the functions: `cd ../functions && npm run build`
4. **Deploy**: `npm run deploy`

## Why This Matters

The shared package is used by:

- Frontend Angular app (`src/app/`)
- Backend Cloud Functions (`functions/src/`)

Keeping it in one place ensures consistency between frontend and backend logic for:

- Aircraft detection (military, helicopter, etc.)
- Notification formatting
- Geographic calculations
- Country detection
- Data type definitions
