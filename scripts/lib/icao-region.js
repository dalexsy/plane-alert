function getIcaoRegion(address) {
  if (address >= 0x000000 && address <= 0x1fffff) return "Africa (AFI)";
  if (address >= 0x200000 && address <= 0x2fffff) return "South America (SAM)";
  if (address >= 0x300000 && address <= 0x4fffff) return "Europe (EUR/NAT)";
  if (address >= 0x500000 && address <= 0x5fffff) {
    return "Europe/North Atlantic (EUR/NAT)";
  }
  if (address >= 0x600000 && address <= 0x6fffff) return "Middle East (MID)";
  if (address >= 0x700000 && address <= 0x77ffff) {
    return "Middle East/Asia (MID/ASIA)";
  }
  if (address >= 0x780000 && address <= 0x7fffff) return "Asia Pacific (ASIA)";
  if (address >= 0x800000 && address <= 0x8fffff) return "Asia (ASIA)";
  if (address >= 0x900000 && address <= 0x9fffff) return "Pacific (PAC)";
  if (address >= 0xa00000 && address <= 0xbfffff) return "North America (NAM)";
  if (address >= 0xc00000 && address <= 0xdfffff) return "North America (NAM)";
  if (address >= 0xe00000 && address <= 0xffffff) return "South America (SAM)";
  return "Unknown";
}

module.exports = { getIcaoRegion };
