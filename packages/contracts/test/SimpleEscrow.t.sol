// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SimpleEscrow} from "../src/SimpleEscrow.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract SimpleEscrowTest is Test {
    SimpleEscrow escrow;
    MockERC20 token;

    address payer = makeAddr("payer");
    address payee = makeAddr("payee");
    uint128 constant AMOUNT = 100e6;

    function setUp() public {
        token = new MockERC20("Mock USD", "mUSD");
        escrow = new SimpleEscrow(token);
        token.mint(payer, 1_000e6);
        vm.prank(payer);
        token.approve(address(escrow), type(uint256).max);
    }

    function _create() internal returns (uint256 id) {
        vm.prank(payer);
        id = escrow.create(payee, AMOUNT, uint64(block.timestamp + 1 days));
    }

    function test_create_locksTokensAndEmits() public {
        vm.expectEmit(address(escrow));
        emit SimpleEscrow.DealCreated(0, payer, payee, AMOUNT, uint64(block.timestamp + 1 days));
        uint256 id = _create();

        assertEq(id, 0);
        assertEq(escrow.nextId(), 1);
        assertEq(escrow.totalLocked(), AMOUNT);
        assertEq(token.balanceOf(address(escrow)), AMOUNT);
    }

    function test_create_revertsWithoutApproval() public {
        address stranger = makeAddr("stranger");
        token.mint(stranger, AMOUNT);
        vm.prank(stranger);
        vm.expectRevert();
        escrow.create(payee, AMOUNT, uint64(block.timestamp + 1));
    }

    function test_create_revertsOnBadInput() public {
        vm.startPrank(payer);
        vm.expectRevert(SimpleEscrow.InvalidPayee.selector);
        escrow.create(address(0), AMOUNT, uint64(block.timestamp + 1));
        vm.expectRevert(SimpleEscrow.InvalidAmount.selector);
        escrow.create(payee, 0, uint64(block.timestamp + 1));
        vm.expectRevert(SimpleEscrow.InvalidDeadline.selector);
        escrow.create(payee, AMOUNT, uint64(block.timestamp));
        vm.stopPrank();
    }

    function test_release_paysPayee() public {
        uint256 id = _create();
        vm.expectEmit(address(escrow));
        emit SimpleEscrow.DealReleased(id, payee, AMOUNT);
        vm.prank(payer);
        escrow.release(id);

        assertEq(token.balanceOf(payee), AMOUNT);
        assertEq(escrow.totalLocked(), 0);
    }

    function test_release_onlyPayer() public {
        uint256 id = _create();
        vm.prank(payee);
        vm.expectRevert(SimpleEscrow.NotPayer.selector);
        escrow.release(id);
    }

    function test_release_cannotRunTwice() public {
        uint256 id = _create();
        vm.startPrank(payer);
        escrow.release(id);
        vm.expectRevert(SimpleEscrow.NotOpen.selector);
        escrow.release(id);
        vm.stopPrank();
    }

    function test_refund_onlyAfterDeadline() public {
        uint256 id = _create();
        vm.startPrank(payer);
        vm.expectRevert(SimpleEscrow.DeadlineNotReached.selector);
        escrow.refund(id);

        vm.warp(block.timestamp + 1 days);
        uint256 before = token.balanceOf(payer);
        escrow.refund(id);
        vm.stopPrank();

        assertEq(token.balanceOf(payer), before + AMOUNT);
        assertEq(escrow.totalLocked(), 0);
    }

    function testFuzz_create_release(uint128 amount, uint64 ttl) public {
        amount = uint128(bound(amount, 1, 1_000e6));
        ttl = uint64(bound(ttl, 1, 365 days));

        vm.prank(payer);
        uint256 id = escrow.create(payee, amount, uint64(block.timestamp) + ttl);
        assertEq(escrow.totalLocked(), amount);

        vm.prank(payer);
        escrow.release(id);
        assertEq(token.balanceOf(payee), amount);
        assertEq(token.balanceOf(address(escrow)), 0);
    }
}
