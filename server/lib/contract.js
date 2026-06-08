const { ethers } = require('ethers');
const artifact    = require('../../build/contracts/RecDapp.json');

let _provider = null;
let _contract  = null;
let _signer    = null;

function getProvider() {
  if (!_provider) {
    const rpc = process.env.RPC_URL ||
      `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
    _provider = new ethers.JsonRpcProvider(rpc);
  }
  return _provider;
}

function getContract() {
  if (!_contract) {
    _contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      artifact.abi,
      getProvider()
    );
  }
  return _contract;
}

function getSignerContract() {
  if (!_signer) {
    _signer = new ethers.Wallet(process.env.ISSUER_PRIVATE_KEY, getProvider());
  }
  return _contract
    ? _contract.connect(_signer)
    : new ethers.Contract(process.env.CONTRACT_ADDRESS, artifact.abi, _signer);
}

// Serialize BigInt fields for JSON responses
function serializeMeta(raw) {
  return {
    issuer:        raw.issuer,
    producer:      raw.producer,
    source:        Number(raw.source),
    kwh:           raw.kwh.toString(),
    location:      raw.location,
    issuedAt:      raw.issuedAt.toString(),
    expiresAt:     raw.expiresAt.toString(),
    fullyRetired:  raw.fullyRetired,
    dataHash:      raw.dataHash,
  };
}

function serializeListing(id, raw) {
  return {
    id:          id.toString(),
    seller:      raw.seller,
    tokenId:     raw.tokenId.toString(),
    amount:      raw.amount.toString(),
    pricePerKwh: raw.pricePerKwh.toString(),
    active:      raw.active,
  };
}

module.exports = { getContract, getSignerContract, serializeMeta, serializeListing };
