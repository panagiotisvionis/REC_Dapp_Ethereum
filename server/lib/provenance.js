/**
 * Issuance-path provenance for a certificate.
 *
 * The decision uses only on-chain values that an issuer cannot choose:
 *   - the issuer field, which RecDapp sets to the registry contract's own
 *     address for Chainlink Functions issuance, and to the calling account
 *     for manual issueRec(); and
 *   - issuedByWorkflow(tokenId), which RecDappWorkflowRegistry sets only for
 *     certificates minted by the CRE consumer contract.
 *
 * The dataHash reference (oracle://, cre://, ipfs://) is supplied freely by a
 * manual issuer, so it is reported but never used to classify a certificate
 * as oracle-mediated.
 */
const ORACLE_REF = /^(oracle|cre):\/\//i;

function resolveProvenance(metadata, { registryAddress = '', issuedByWorkflow = false } = {}) {
  const issuer   = String(metadata.issuer || '').toLowerCase();
  const registry = String(registryAddress || '').toLowerCase();
  const referenceClaimsOracle = ORACLE_REF.test(String(metadata.dataHash || ''));

  if (registry && issuer === registry) {
    return { path: 'functions', oracleMediated: true, referenceClaimsOracle };
  }
  if (issuedByWorkflow === true) {
    return { path: 'workflow', oracleMediated: true, referenceClaimsOracle };
  }
  return { path: 'manual', oracleMediated: false, referenceClaimsOracle };
}

module.exports = { resolveProvenance };
