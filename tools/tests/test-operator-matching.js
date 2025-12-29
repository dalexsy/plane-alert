// Test the operator matching logic
// This script intentionally runs under plain Node (no ts-node).
// We load the TS config by transpiling it to CommonJS in-memory.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function findRepoRoot(startDir) {
  let current = startDir;
  for (let i = 0; i < 12; i += 1) {
    const angularJson = path.join(current, "angular.json");
    const packageJson = path.join(current, "package.json");
    if (fs.existsSync(angularJson) && fs.existsSync(packageJson)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

function loadTsExports(tsFilePath) {
  const source = fs.readFileSync(tsFilePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: false,
    },
    fileName: tsFilePath,
  });

  const moduleObj = { exports: {} };
  const sandbox = {
    module: moduleObj,
    exports: moduleObj.exports,
    require,
    __filename: tsFilePath,
    __dirname: path.dirname(tsFilePath),
    console,
    process,
  };

  vm.runInNewContext(compiled.outputText, sandbox, { filename: tsFilePath });
  return moduleObj.exports;
}

const repoRoot = findRepoRoot(__dirname);
const operatorConfigPath = path.join(
  repoRoot,
  "src",
  "app",
  "config",
  "operator-symbols.config.ts"
);

const { OPERATOR_SYMBOLS } = loadTsExports(operatorConfigPath);

// Test plane objects
const testPlanes = [
  {
    operator: "United States Navy",
    country: "US",
    isMilitary: true,
    expected: "us_navy",
  },
  {
    operator: "US Navy",
    country: "US",
    isMilitary: true,
    expected: "us_navy",
  },
  {
    operator: "United States Air Force",
    country: "US",
    isMilitary: true,
    expected: "us_air_force",
  },
  {
    operator: "Some Random Airline",
    country: "US",
    isMilitary: true,
    expected: "us_air_force", // Should fall back to country-based matching
  },
  {
    operator: "Some Random Airline",
    country: "DE",
    isMilitary: true,
    expected: "de_air_force", // Should fall back to country-based matching
  },
];

// Test function (simulating the service logic)
function getSymbolConfig(plane) {
  const country = plane.country?.toLowerCase();
  const operator = plane.operator?.toLowerCase();

  // First, try to match by specific operator name
  if (operator) {
    const operatorMatch = OPERATOR_SYMBOLS.find(
      (cfg) =>
        cfg.operators &&
        cfg.operators.some(
          (op) =>
            operator.includes(op.toLowerCase()) ||
            op.toLowerCase().includes(operator)
        )
    );
    if (operatorMatch) {
      return operatorMatch;
    }
  }

  // Fall back to country-based matching
  if (country) {
    return OPERATOR_SYMBOLS.find((cfg) =>
      (cfg.countries ?? []).includes(country)
    );
  }

  return null;
}

// Run tests
console.log("Testing operator matching logic:");
testPlanes.forEach((testPlane, index) => {
  const result = getSymbolConfig(testPlane);
  const success = result?.key === testPlane.expected;
  console.log(`Test ${index + 1}: ${success ? "PASS" : "FAIL"}`);
  console.log(`  Operator: "${testPlane.operator}"`);
  console.log(`  Country: "${testPlane.country}"`);
  console.log(`  Expected: "${testPlane.expected}"`);
  console.log(`  Got: "${result?.key || "null"}"`);
  console.log("");
});
