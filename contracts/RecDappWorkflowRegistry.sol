// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./RecDapp.sol";

/**
 * RecChain — registry side of the revised CRE issuance path.
 *
 * RecDappCRE (the CRE report consumer) mints through issueFromWorkflow(). The
 * evaluated RecDapp.sol has no such entry point, and it is left unmodified here
 * so that the gas and coverage figures reported for it remain reproducible.
 * This contract extends it with that entry point and nothing else.
 *
 * Trust model
 * -----------
 *  - issueFromWorkflow() is restricted to WORKFLOW_ROLE, which the registry
 *    administrator grants to the deployed RecDappCRE consumer contract.
 *  - The consumer is recorded as the certificate issuer, and the registry
 *    marks the token in issuedByWorkflow. Neither value can be set through the
 *    manual issueRec() path, so off-chain tools can separate screened from
 *    manually issued certificates without trusting the dataHash reference,
 *    which a manual issuer chooses freely.
 *  - The legacy Chainlink Functions path is inherited unchanged; certificates
 *    issued through it carry this contract's own address as issuer.
 */
contract RecDappWorkflowRegistry is RecDapp {
    bytes32 public constant WORKFLOW_ROLE = keccak256("WORKFLOW_ROLE");

    /// True only for certificates minted through issueFromWorkflow().
    mapping(uint256 => bool) public issuedByWorkflow;

    event WorkflowIssuance(uint256 indexed tokenId, address indexed consumer, string provenanceRef);

    constructor(string memory uri_, address functionsRouter)
        RecDapp(uri_, functionsRouter)
    {}

    /**
     * Mint a certificate on behalf of the CRE consumer contract. The 1 MWh
     * floor and the producer check are enforced by _issueRec, exactly as for
     * the other two paths.
     */
    function issueFromWorkflow(
        address producer,
        uint8   source,
        uint256 kwh,
        string calldata location,
        string calldata provenanceRef
    ) external onlyRole(WORKFLOW_ROLE) returns (uint256 tokenId) {
        require(source <= uint8(type(EnergySource).max), "Invalid source");
        tokenId = _issueRec(msg.sender, producer, EnergySource(source), kwh, location, provenanceRef);
        issuedByWorkflow[tokenId] = true;
        emit WorkflowIssuance(tokenId, msg.sender, provenanceRef);
    }
}
