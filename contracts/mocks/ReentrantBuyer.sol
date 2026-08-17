// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRecDapp {
    function buyRec(uint256 listingId, uint256 amount) external payable;
}

/**
 * Test-only attacker. On receiving the ERC-1155 units transferred by buyRec,
 * it re-enters buyRec from inside the receiver hook. RecDapp.buyRec carries
 * OpenZeppelin's nonReentrant modifier, so the outer call must revert.
 *
 * Not part of the deployed system; used exclusively by test/RecDapp.test.js.
 */
contract ReentrantBuyer {
    IRecDapp public immutable target;
    uint256  public immutable listingId;
    uint256  public immutable pricePerKwh;
    bool     private _entered;

    constructor(address _target, uint256 _listingId, uint256 _pricePerKwh) {
        target      = IRecDapp(_target);
        listingId   = _listingId;
        pricePerKwh = _pricePerKwh;
    }

    function attack(uint256 amount) external payable {
        target.buyRec{value: amount * pricePerKwh}(listingId, amount);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external returns (bytes4)
    {
        if (!_entered) {
            _entered = true;
            // Re-entrant call: must be rejected by ReentrancyGuard.
            target.buyRec{value: pricePerKwh}(listingId, 1);
        }
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, address, uint256[] calldata, uint256[] calldata, bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4) external pure returns (bool) {
        return true;
    }

    receive() external payable {}
}
