// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SimpleEscrow} from "../src/SimpleEscrow.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice Fork-test example. Skipped unless FORK_RPC_URL is set, e.g.
///         FORK_RPC_URL=$SEPOLIA_RPC_URL forge test --match-contract ForkTest -vv
contract ForkTest is Test {
    function setUp() public {
        string memory rpc = vm.envOr("FORK_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
    }

    function test_fork_deployAndUseEscrow() public {
        vm.skip(bytes(vm.envOr("FORK_RPC_URL", string(""))).length == 0);

        assertGt(block.number, 0, "fork should start at a live block");
        MockERC20 token = new MockERC20("Mock USD", "mUSD");
        SimpleEscrow escrow = new SimpleEscrow(token);
        address payee = makeAddr("payee");

        token.mint(address(this), 10e6);
        token.approve(address(escrow), 10e6);
        uint256 id = escrow.create(payee, 10e6, uint64(block.timestamp + 1 hours));
        escrow.release(id);
        assertEq(token.balanceOf(payee), 10e6);
    }
}
