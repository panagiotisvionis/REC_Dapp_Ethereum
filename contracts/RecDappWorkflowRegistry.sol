// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./RecDapp.sol";
import "./IWorkflowRegistry.sol";

/// Research registry. Uniqueness applies to the workflow path and a governed
/// canonical meter identifier, not to manual issuance or external registries.
contract RecDappWorkflowRegistry is RecDapp, IWorkflowRegistry {
    bytes32 public constant WORKFLOW_ROLE = keccak256("WORKFLOW_ROLE");
    mapping(uint256 => bool) public issuedByWorkflow;
    mapping(bytes32 => uint64) public lastIssuedEnd;
    mapping(bytes32 => bool) public consumedInterval;
    struct Receipt {
        bytes32 meterHash;
        uint64 start;
        uint64 end;
        bytes32 evidenceHash;
        bytes32 policyHash;
    }
    mapping(uint256 => Receipt) public issuanceReceipt;
    event WorkflowIssuance(uint256 indexed tokenId, address indexed consumer, string provenanceRef);
    event IssuanceEvidence(uint256 indexed tokenId, bytes32 indexed intervalKey,
        bytes32 evidenceHash, bytes32 policyHash);

    constructor(string memory uri_, address router) RecDapp(uri_, router) {}

    function issueFromWorkflow(Batch calldata b)
        external onlyRole(WORKFLOW_ROLE) nonReentrant returns (uint256 tokenId)
    {
        require(bytes(b.meterId).length > 0, "Empty meter");
        require(b.source <= uint8(type(EnergySource).max), "Invalid source");
        require(b.start > 0 && b.end > b.start && b.end <= block.timestamp, "Invalid interval");
        require(b.evidenceHash != bytes32(0) && b.policyHash != bytes32(0), "Missing evidence");
        bytes32 meterHash = keccak256(bytes(b.meterId));
        bytes32 key = keccak256(abi.encode(block.chainid, address(this), meterHash, b.start, b.end));
        require(!consumedInterval[key], "Interval already issued");
        require(b.start >= lastIssuedEnd[meterHash], "Overlapping or out-of-order interval");
        // Checks and effects precede _mint's ERC-1155 receiver hook.
        consumedInterval[key] = true;
        lastIssuedEnd[meterHash] = b.end;
        string memory provenanceRef = string.concat("cre://", b.meterId);
        tokenId = _issueRec(msg.sender, b.producer, EnergySource(b.source), b.kwh, b.location, provenanceRef);
        issuedByWorkflow[tokenId] = true;
        issuanceReceipt[tokenId] = Receipt(meterHash, b.start, b.end, b.evidenceHash, b.policyHash);
        emit WorkflowIssuance(tokenId, msg.sender, provenanceRef);
        emit IssuanceEvidence(tokenId, key, b.evidenceHash, b.policyHash);
    }
}
