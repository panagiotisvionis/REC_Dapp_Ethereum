// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../IWorkflowRegistry.sol";
contract MockRecIssuer is IWorkflowRegistry {
    uint256 public callCount;
    address public lastProducer;
    uint8 public lastSource;
    uint256 public lastKwh;
    string public lastLocation;
    string public lastProvenance;
    function issueFromWorkflow(Batch calldata b) external returns (uint256) {
        ++callCount; lastProducer=b.producer;lastSource=b.source;lastKwh=b.kwh;
        lastLocation=b.location;lastProvenance=string.concat("cre://",b.meterId);
        return callCount;
    }
}
