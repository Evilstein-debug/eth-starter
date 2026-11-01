// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SimpleEscrow} from "../src/SimpleEscrow.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @dev The fuzzer calls these functions in random order with random inputs.
contract EscrowHandler is Test {
    SimpleEscrow public immutable escrow;
    MockERC20 public immutable token;
    address[] public actors;
    uint256[] public openIds;

    constructor(SimpleEscrow escrow_, MockERC20 token_) {
        escrow = escrow_;
        token = token_;
        for (uint256 i; i < 3; i++) {
            address actor = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(actor);
            vm.prank(actor);
            token.approve(address(escrow), type(uint256).max);
        }
    }

    function create(uint256 actorSeed, uint128 amount, uint64 ttl) external {
        address payer = actors[actorSeed % actors.length];
        address payee = actors[(actorSeed + 1) % actors.length];
        amount = uint128(bound(amount, 1, 1_000_000e6));
        ttl = uint64(bound(ttl, 1, 30 days));

        token.mint(payer, amount);
        vm.prank(payer);
        openIds.push(escrow.create(payee, amount, uint64(block.timestamp) + ttl));
    }

    function release(uint256 idSeed) external {
        if (openIds.length == 0) return;
        uint256 id = _popOpen(idSeed);
        (address payer,,,,) = escrow.deals(id);
        vm.prank(payer);
        escrow.release(id);
    }

    function refund(uint256 idSeed) external {
        if (openIds.length == 0) return;
        uint256 id = _popOpen(idSeed);
        (address payer,,, uint64 deadline,) = escrow.deals(id);
        if (block.timestamp < deadline) vm.warp(deadline);
        vm.prank(payer);
        escrow.refund(id);
    }

    function _popOpen(uint256 seed) private returns (uint256 id) {
        uint256 i = seed % openIds.length;
        id = openIds[i];
        openIds[i] = openIds[openIds.length - 1];
        openIds.pop();
    }
}

contract SimpleEscrowInvariantTest is Test {
    SimpleEscrow escrow;
    MockERC20 token;
    EscrowHandler handler;

    function setUp() public {
        token = new MockERC20("Mock USD", "mUSD");
        escrow = new SimpleEscrow(token);
        handler = new EscrowHandler(escrow, token);
        targetContract(address(handler));
    }

    /// @notice The escrow always holds exactly the tokens it has accounted for.
    function invariant_balanceMatchesTotalLocked() public view {
        assertEq(token.balanceOf(address(escrow)), escrow.totalLocked());
    }
}
