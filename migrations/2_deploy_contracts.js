const RecDapp = artifacts.require("RecDapp");

// Chainlink Functions router addresses
const FUNCTIONS_ROUTERS = {
  sepolia:    '0xb83E47C2bC239B3bf370bc41e1459A34b41238D0',
  amoy:       '0xC22a79eBA640940ABB6dF0f7982cc119578E11De',
  polygon:    '0xdc2AAF042Aeff2E68B3e8E33F19e4B9fA7C73F10',
  // For local development, use a dummy address
  development: '0x0000000000000000000000000000000000000001',
};

module.exports = async function (deployer, network) {
  const metadataUri = "ipfs://YOUR_IPFS_BASE_CID/{id}.json";
  const router      = FUNCTIONS_ROUTERS[network] || FUNCTIONS_ROUTERS.development;

  console.log(`Deploying RecDapp on "${network}" with Functions router: ${router}`);
  await deployer.deploy(RecDapp, metadataUri, router);

  const instance = await RecDapp.deployed();
  console.log(`RecDapp deployed at: ${instance.address}`);
};
