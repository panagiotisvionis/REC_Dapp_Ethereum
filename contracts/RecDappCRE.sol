// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IWorkflowRegistry.sol";

/// CRE report consumer. Requires a pinned workflow identity, freshness and a
/// consumed payload guard. DON signature verification remains the forwarder's
/// responsibility. Not deployed or independently security-audited.
contract RecDappCRE is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    address public forwarder;
    bytes32 public workflowId;
    bytes10 public workflowName;
    address public workflowOwner;
    uint64 public maxReportAge = 7 days;
    IWorkflowRegistry public immutable registry;
    struct MeterBinding { address producer; uint8 source; string location; bool enabled; }
    struct Reading {
        string meterId;
        uint64 start;
        uint64 end;
        uint256 kwh;
        bytes32 evidenceHash;
        bytes32 policyHash;
    }
    mapping(string => MeterBinding) private _meters;
    mapping(bytes32 => bool) public consumedReport;
    event MeterBound(string meterId, address producer, uint8 source, string location);
    event MeterUnbound(string meterId);
    event IssuanceAccepted(string meterId, uint256 tokenId, uint256 kwh);
    event IssuanceRejected(string meterId, uint256 kwh, string reason);
    event ForwarderUpdated(address forwarder);
    event WorkflowConfigured(bytes32 workflowId, bytes10 workflowName, address workflowOwner);
    error UnauthorisedForwarder(address caller);
    error InvalidMetadata();
    error UnauthorisedWorkflow();
    error ReportAlreadyConsumed();

    constructor(address registry_, address forwarder_) {
        require(registry_ != address(0) && forwarder_ != address(0), "Zero address");
        registry = IWorkflowRegistry(registry_);
        forwarder = forwarder_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    function setForwarder(address value) external onlyRole(ADMIN_ROLE) {
        require(value != address(0), "Zero address");
        forwarder = value;
        emit ForwarderUpdated(value);
    }
    function setWorkflow(bytes32 id, bytes10 name, address owner) external onlyRole(ADMIN_ROLE) {
        require(id != bytes32(0) && name != bytes10(0) && owner != address(0), "Empty workflow identity");
        workflowId = id; workflowName = name; workflowOwner = owner;
        emit WorkflowConfigured(id, name, owner);
    }
    function setMaxReportAge(uint64 age) external onlyRole(ADMIN_ROLE) {
        require(age > 0 && age <= 30 days, "Invalid report age");
        maxReportAge = age;
    }
    function bindMeter(string calldata id, address producer, uint8 source, string calldata location)
        external onlyRole(ADMIN_ROLE)
    {
        require(bytes(id).length > 0 && bytes(id).length <= 128, "Invalid meter ID");
        require(producer != address(0), "Invalid producer");
        require(source <= 5, "Invalid source");
        _meters[id] = MeterBinding(producer, source, location, true);
        emit MeterBound(id, producer, source, location);
    }
    function unbindMeter(string calldata id) external onlyRole(ADMIN_ROLE) {
        delete _meters[id]; emit MeterUnbound(id);
    }
    function meterBinding(string calldata id) external view returns (MeterBinding memory) { return _meters[id]; }

    function onReport(bytes calldata metadata, bytes calldata report) external nonReentrant {
        if (msg.sender != forwarder) revert UnauthorisedForwarder(msg.sender);
        // Production forwarder supplies 64 bytes; 62 supports packed test tooling.
        if (metadata.length != 62 && metadata.length != 64) revert InvalidMetadata();
        bytes32 id = bytes32(metadata[0:32]);
        bytes10 name = bytes10(metadata[32:42]);
        address owner = address(bytes20(metadata[42:62]));
        if (workflowId == bytes32(0) || id != workflowId || name != workflowName || owner != workflowOwner)
            revert UnauthorisedWorkflow();
        bytes32 digest = keccak256(abi.encode(block.chainid, address(this), id, report));
        if (consumedReport[digest]) revert ReportAlreadyConsumed();
        Reading[] memory readings = abi.decode(report, (Reading[]));
        require(readings.length <= 100, "Report too large");
        consumedReport[digest] = true;
        for (uint256 i; i < readings.length; ++i) {
            Reading memory r = readings[i];
            MeterBinding memory b = _meters[r.meterId];
            if (!b.enabled) { emit IssuanceRejected(r.meterId,r.kwh,"meter not bound"); continue; }
            if (r.kwh < 1000) { emit IssuanceRejected(r.meterId,r.kwh,"below 1 MWh floor"); continue; }
            if (r.start == 0 || r.end <= r.start || r.end > block.timestamp || block.timestamp-r.end > maxReportAge) {
                emit IssuanceRejected(r.meterId,r.kwh,"invalid or stale interval"); continue;
            }
            uint256 tokenId = registry.issueFromWorkflow(IWorkflowRegistry.Batch(
                b.producer,b.source,r.kwh,b.location,r.meterId,r.start,r.end,r.evidenceHash,r.policyHash));
            emit IssuanceAccepted(r.meterId,tokenId,r.kwh);
        }
    }
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == bytes4(keccak256("onReport(bytes,bytes)")) || super.supportsInterface(interfaceId);
    }
}
