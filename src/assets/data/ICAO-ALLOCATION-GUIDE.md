# ICAO Country Range Allocation Guide

## Important: How to Fix Wrong Aircraft Countries/Flags

When aircraft show incorrect flags or countries, **DO NOT** add individual ICAO code overrides in the code!

### The Right Way: Range-Based Analysis

1. **Convert ICAO hex to decimal** to understand which range the aircraft falls into
2. **Check the allocation** in `icao-country-ranges.json`
3. **Verify against official sources** if the range allocation is correct
4. **Update the range data** if incorrect (this file)
5. **Add new ranges** for special cases (e.g., military using non-standard allocations)

### Example: Swiss Military Aircraft Issue (Fixed)

**Problem**: Aircraft `4B7FAC`, `4B7FAE`, `4B7FAB`, `4B7F5B` showed Swedish flags but are Swiss military

**Analysis**:

- `4B7FAC` = 4,947,884 decimal
- Falls in range `4A0000-4BFFFF` (4,849,664 to 4,980,735 decimal)
- This range was allocated to Sweden (`SE`)

**Solution**: Split the Swedish range to carve out Swiss military allocation:

```json
// Before (wrong):
{"startHex": "4A0000", "finishHex": "4BFFFF", "countryISO2": "SE"}

// After (correct):
{"startHex": "4A0000", "finishHex": "4B7EFF", "countryISO2": "SE"},
{"startHex": "4B7F00", "finishHex": "4B7FFF", "countryISO2": "CH", "isMilitary": true},
{"startHex": "4B8000", "finishHex": "4BFFFF", "countryISO2": "SE"}
```

### Why This Approach Works

- **Scalable**: All aircraft in the range are automatically handled
- **Maintainable**: No hardcoded exceptions in the code
- **Data-driven**: Uses the existing range lookup system
- **Accurate**: Reflects actual ICAO allocations

### Tools for Analysis

- ICAO hex to decimal converter: `parseInt('4B7FAC', 16)` = 4947884
- Check which range contains the decimal value
- Verify allocation sources against official ICAO documents

## Data Sources

This file should reflect official ICAO 24-bit address allocations, with corrections for:

- Military aircraft using non-standard ranges
- Updated allocations not reflected in older datasets
- Special allocations for government/military use
