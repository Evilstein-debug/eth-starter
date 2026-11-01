// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockOracle
/// @notice Admin-settable price feed. Exposes a Chainlink AggregatorV3-style read surface
///         (`decimals`, `latestRoundData`) so it can be swapped for a real feed later.
contract MockOracle is Ownable {
    uint8 public immutable decimals;
    int256 public price;
    uint256 public updatedAt;
    uint80 public roundId;

    event PriceUpdated(uint80 indexed roundId, int256 price, uint256 updatedAt);

    constructor(address owner_, uint8 decimals_, int256 initialPrice) Ownable(owner_) {
        decimals = decimals_;
        _setPrice(initialPrice);
    }

    function setPrice(int256 newPrice) external onlyOwner {
        _setPrice(newPrice);
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, price, updatedAt, updatedAt, roundId);
    }

    function _setPrice(int256 newPrice) private {
        price = newPrice;
        updatedAt = block.timestamp;
        roundId++;
        emit PriceUpdated(roundId, newPrice, block.timestamp);
    }
}
