// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title MockERC20
/// @notice 6-decimal, freely mintable test stablecoin with EIP-2612 permit. TESTNET ONLY.
contract MockERC20 is ERC20, ERC20Permit {
    constructor(string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Anyone can mint. This is a faucet token, never deploy it as a real asset.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
