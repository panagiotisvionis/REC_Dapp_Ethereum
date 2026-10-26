// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IWorkflowRegistry {
    struct Batch {
        address producer;
        uint8 source;
        uint256 kwh;
        string location;
        string meterId;
        uint64 start;
        uint64 end;
        bytes32 evidenceHash;
        bytes32 policyHash;
    }
    function issueFromWorkflow(Batch calldata batch) external returns (uint256);
}
