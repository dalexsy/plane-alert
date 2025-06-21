// Simple test for the formatDistance function logic
function formatDistance(distance) {
  // Use English locale formatting to ensure period as decimal separator
  // Format to 1 decimal place, with minimum 1 and maximum 1 decimal digit
  return distance.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

// Test values
const testValues = [31.1, 5.7, 12.0, 0.5, 100.3];

console.log('Testing formatDistance function:');
testValues.forEach(val => {
  const formatted = formatDistance(val);
  console.log(`${val} -> "${formatted}"`);
});
