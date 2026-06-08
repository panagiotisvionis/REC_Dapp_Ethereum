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

// Demo mode — set VITE_DEMO_MODE=true in .env.local for investor demos
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Network config — override via .env.local for local dev
// VITE_CHAIN_ID=0x539  (Hardhat 1337) or 0xaa36a7 (Sepolia 11155111)
export const TARGET_CHAIN_ID  = import.meta.env.VITE_CHAIN_ID    || '0xaa36a7';
export const NETWORK_NAME     = import.meta.env.VITE_NETWORK_NAME || 'Sepolia';

// Keep alias for any components that still import SEPOLIA_CHAIN_ID
export const SEPOLIA_CHAIN_ID = TARGET_CHAIN_ID;
