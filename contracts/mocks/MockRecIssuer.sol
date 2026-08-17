// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Test-only stand-in for the certificate registry, recording the arguments of
 * the last issuance so that RecDappCRE's decoding and binding logic can be
 * asserted without deploying the full ERC-1155 contract.
 */
contract MockRecIssuer {
    uint256 public callCount;
    address public lastProducer;
    uint8   public lastSource;
    uint256 public lastKwh;
    string  public lastLocation;
    string  public lastProvenance;

    function issueFromWorkflow(
        address producer,
        uint8   source,
        uint256 kwh,
        string calldata location,
        string calldata provenanceRef
    ) external returns (uint256) {
        callCount++;
        lastProducer   = producer;
        lastSource     = source;
        lastKwh        = kwh;
        lastLocation   = location;
        lastProvenance = provenanceRef;
        return callCount;
    }
}
