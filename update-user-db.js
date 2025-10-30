#!/usr/bin/env node

/**
 * Script to update user-aircraft-db.json from localStorage data
 * Run this after the app has been running and collected aircraft data
 */

const fs = require('fs');
const path = require('path');

// This would need to be run in an environment where localStorage is available
// For now, this is a placeholder - the user can manually copy from console

console.log('To update user-aircraft-db.json:');
console.log('1. Open the running app in browser');
console.log('2. Open browser console (F12)');
console.log('3. Run: aircraftDbService.getCurrentUserDbForFile()');
console.log('4. Copy the logged content');
console.log('5. Paste it into src/assets/user-aircraft-db.json');
console.log('');
console.log('Or run: copy(window.planeAlertUserDb) to copy to clipboard');