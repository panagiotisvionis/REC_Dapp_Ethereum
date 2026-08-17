// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * RecChain — CRE report receiver (migration target).
 *
 * STATUS: report receiver for the CRE workflow in cre/screening/main.ts.
 * Chainlink Functions
 * sunset on 30 June 2026 (testnet 15 June 2026), so the FunctionsClient path in
 * RecDapp.sol can no longer be used for new issuance. This contract replaces
 * the request/callback model with the CRE report model:
 *
 *     Functions                        CRE
 *     ---------                        ---
 *     requestAutoIssuance()            workflow cron trigger (off-chain)
 *     source.js on the DON             cre/screening/main.ts
 *     fulfillRequest() callback        onReport() from the CRE forwarder
 *     one request -> one certificate   one report -> N certificates
 *
 * NOT YET DEPLOYED. The registry address, forwarder address and workflow
 * identifier must be set from a real CRE deployment before this is used, and
 * the manuscript must not describe it as live until that has happened.
 *
 * DESIGN NOTES
 * ------------
 * Screening moved off-chain in both designs, but the trust properties differ.
 * Under Functions the 3-sigma test consumed a mean and standard deviation
 * supplied by the same endpoint as the reading, and was skipped when they were
 * absent. The CRE workflow computes those moments itself from the trailing
 * history and rejects when the history is unavailable, so what this contract
 * accepts is the output of the statistic the paper evaluates, not the
 * endpoint's self-assessment.
 *
 * Rejections are emitted rather than dropped, closing the observability gap
 * noted for the Functions callback, where a sub-floor volume terminated
 * silently.
 */
interface IRecIssuer {
    function issueFromWorkflow(
        address producer,
        uint8   source,
        uint256 kwh,
        string calldata location,
        string calldata provenanceRef
    ) external returns (uint256);
}

contract RecDappCRE is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// The CRE forwarder permitted to deliver reports.
    address public forwarder;
    /// The workflow whose reports are honoured, and its owner.
    bytes10 public workflowName;
    address public workflowOwner;

    IRecIssuer public immutable registry;

    struct MeterBinding {
        address producer;
        uint8   source;      // EnergySource enum in the registry
        string  location;    // ISO 3166-2
        bool    enabled;
    }

    mapping(string => MeterBinding) private _meters;

    event MeterBound(string meterId, address producer, uint8 source, string location);
    event MeterUnbound(string meterId);
    event IssuanceAccepted(string meterId, uint256 tokenId, uint256 kwh);
    event IssuanceRejected(string meterId, uint256 kwh, string reason);
    event ForwarderUpdated(address forwarder);

    error UnauthorisedForwarder(address caller);
    error LengthMismatch();

    constructor(address registry_, address forwarder_) {
        registry  = IRecIssuer(registry_);
        forwarder = forwarder_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ── Administration ───────────────────────────────────────────────────────

    function setForwarder(address forwarder_) external onlyRole(ADMIN_ROLE) {
        forwarder = forwarder_;
        emit ForwarderUpdated(forwarder_);
    }

    function setWorkflow(bytes10 name_, address owner_) external onlyRole(ADMIN_ROLE) {
        workflowName  = name_;
        workflowOwner = owner_;
    }

    /**
     * Bind a meter to the producer and attributes its certificates carry.
     * Binding on-chain, rather than passing them in the report, means the
     * workflow cannot choose who receives a certificate.
     */
    function bindMeter(
        string calldata meterId,
        address producer,
        uint8   source,
        string calldata location
    ) external onlyRole(ADMIN_ROLE) {
        require(producer != address(0), "Invalid producer");
        _meters[meterId] = MeterBinding(producer, source, location, true);
        emit MeterBound(meterId, producer, source, location);
    }

    function unbindMeter(string calldata meterId) external onlyRole(ADMIN_ROLE) {
        delete _meters[meterId];
        emit MeterUnbound(meterId);
    }

    function meterBinding(string calldata meterId)
        external view returns (MeterBinding memory)
    {
        return _meters[meterId];
    }

    // ── Report reception ─────────────────────────────────────────────────────

    /**
     * Delivered by the CRE forwarder once the workflow's report is signed by
     * the DON. `report` carries abi.encode(string[] meterIds, uint256[] kwh),
     * holding only readings that already passed the workflow's screening.
     */
    function onReport(bytes calldata /* metadata */, bytes calldata report) external {
        if (msg.sender != forwarder) revert UnauthorisedForwarder(msg.sender);

        (string[] memory meterIds, uint256[] memory kwh) =
            abi.decode(report, (string[], uint256[]));
        if (meterIds.length != kwh.length) revert LengthMismatch();

        for (uint256 i = 0; i < meterIds.length; i++) {
            MeterBinding memory b = _meters[meterIds[i]];

            if (!b.enabled) {
                emit IssuanceRejected(meterIds[i], kwh[i], "meter not bound");
                continue;
            }
            if (kwh[i] < 1000) {
                // Emitted rather than dropped: the Functions callback returned
                // silently here, leaving the outcome invisible off-chain.
                emit IssuanceRejected(meterIds[i], kwh[i], "below 1 MWh floor");
                continue;
            }

            uint256 tokenId = registry.issueFromWorkflow(
                b.producer,
                b.source,
                kwh[i],
                b.location,
                string.concat("cre://", meterIds[i])
            );
            emit IssuanceAccepted(meterIds[i], tokenId, kwh[i]);
        }
    }
}
