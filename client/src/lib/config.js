import artifact from '@contracts/RecDapp.json';

export const CONTRACT_ABI     = artifact.abi;
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

export const ENERGY_SOURCES = ['Solar', 'Wind', 'Hydro', 'Biomass', 'Geothermal', 'Other'];

export const SOURCE_ICONS = {
  Solar:      '☀️',
  Wind:       '💨',
  Hydro:      '💧',
  Biomass:    '🌿',
  Geothermal: '🌋',
  Other:      '⚡',
};

// 1 MWh ≈ 0.35 tCO₂ avoided (EU average grid emission factor)
export const CO2_PER_MWH = 0.35;

export const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111

export const ISSUER_ROLE = '0x0100c9b5e1d1094e2f9d8faa29f62b3b25d24a2a1f7a3d2b0c5e6f8a9b2c3d4'; // placeholder — resolved from contract at runtime
