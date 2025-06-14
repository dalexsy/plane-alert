// Test script to verify RAF aircraft ICAO lookup fix
console.log("Testing RAF ICAO 43C8DB conversion...");

const testIcao = "43C8DB";
const decimal = parseInt(testIcao, 16);
console.log(`ICAO ${testIcao} = ${decimal} decimal`);

// UK range from JSON: 400000-43FFFF (4194304-4456447)
const ukRangeStart = 4194304;
const ukRangeEnd = 4456447;

console.log(`UK Range: ${ukRangeStart} - ${ukRangeEnd}`);
console.log(
  `Is ${decimal} in UK range? ${
    decimal >= ukRangeStart && decimal <= ukRangeEnd
  }`
);

// Test a few other RAF ICAOs
const rafIcaos = ["43C8C1", "43C8DB", "400001", "43FFFF"];
rafIcaos.forEach((icao) => {
  const dec = parseInt(icao, 16);
  const inRange = dec >= ukRangeStart && dec <= ukRangeEnd;
  console.log(`${icao} (${dec}) -> UK Range: ${inRange}`);
});
