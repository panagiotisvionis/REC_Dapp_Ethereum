// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFunctionsClientLike {
    function handleOracleFulfillment(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) external;
}

/**
 * Minimal stand-in for the Chainlink Functions router, sufficient to exercise
 * the request/fulfil cycle of RecDapp in a local test environment.
 *
 * `sendRequest` records the call and returns a deterministic request id;
 * `fulfil` plays the role of the DON delivering a response, invoking the
 * client's `handleOracleFulfillment` so that the router-only guard is honoured.
 *
 * Not part of the deployed system; used exclusively by the test suite.
 */
contract MockFunctionsRouter {
    uint256 public requestCount;
    bytes32 public lastRequestId;
    bytes   public lastData;
    uint64  public lastSubscriptionId;
    uint32  public lastCallbackGasLimit;
    bytes32 public lastDonId;

    function sendRequest(
        uint64  subscriptionId,
        bytes calldata data,
        uint16,
        uint32  callbackGasLimit,
        bytes32 donId
    ) external returns (bytes32) {
        requestCount++;
        lastRequestId        = keccak256(abi.encodePacked(msg.sender, requestCount));
        lastData             = data;
        lastSubscriptionId   = subscriptionId;
        lastCallbackGasLimit = callbackGasLimit;
        lastDonId            = donId;
        return lastRequestId;
    }

    /// Deliver a successful response carrying an ABI-encoded uint256 kWh value.
    function fulfilWithValue(address client, bytes32 requestId, uint256 kwh) external {
        IFunctionsClientLike(client).handleOracleFulfillment(
            requestId, abi.encode(kwh), bytes(""));
    }

    /// Deliver an error response, as the DON does when the script throws.
    function fulfilWithError(address client, bytes32 requestId, string calldata reason) external {
        IFunctionsClientLike(client).handleOracleFulfillment(
            requestId, bytes(""), bytes(reason));
    }
}
