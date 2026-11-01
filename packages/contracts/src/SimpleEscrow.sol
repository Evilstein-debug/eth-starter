// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SimpleEscrow
/// @notice Example contract: a payer locks ERC-20 tokens for a payee. The payer can release
///         them to the payee at any time, or refund them to themselves after the deadline.
/// @dev    Replace or delete this; it exists to exercise the stack end to end.
contract SimpleEscrow {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Open,
        Released,
        Refunded
    }

    struct Deal {
        address payer;
        address payee;
        uint128 amount;
        uint64 deadline;
        Status status;
    }

    IERC20 public immutable token;
    uint256 public nextId;
    uint256 public totalLocked;
    mapping(uint256 id => Deal) public deals;

    event DealCreated(
        uint256 indexed id,
        address indexed payer,
        address indexed payee,
        uint256 amount,
        uint64 deadline
    );
    event DealReleased(uint256 indexed id, address indexed payee, uint256 amount);
    event DealRefunded(uint256 indexed id, address indexed payer, uint256 amount);

    error InvalidPayee();
    error InvalidAmount();
    error InvalidDeadline();
    error NotPayer();
    error NotOpen();
    error DeadlineNotReached();

    constructor(IERC20 token_) {
        token = token_;
    }

    /// @notice Lock `amount` tokens for `payee`. Caller must `approve` this contract first.
    function create(address payee, uint128 amount, uint64 deadline) external returns (uint256 id) {
        if (payee == address(0) || payee == msg.sender) revert InvalidPayee();
        if (amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        id = nextId++;
        deals[id] = Deal(msg.sender, payee, amount, deadline, Status.Open);
        totalLocked += amount;

        token.safeTransferFrom(msg.sender, address(this), amount);
        emit DealCreated(id, msg.sender, payee, amount, deadline);
    }

    /// @notice Payer releases the locked tokens to the payee.
    function release(uint256 id) external {
        Deal storage deal = _openDealOf(id);
        deal.status = Status.Released;
        totalLocked -= deal.amount;

        token.safeTransfer(deal.payee, deal.amount);
        emit DealReleased(id, deal.payee, deal.amount);
    }

    /// @notice Payer reclaims the tokens once the deadline has passed.
    function refund(uint256 id) external {
        Deal storage deal = _openDealOf(id);
        if (block.timestamp < deal.deadline) revert DeadlineNotReached();
        deal.status = Status.Refunded;
        totalLocked -= deal.amount;

        token.safeTransfer(deal.payer, deal.amount);
        emit DealRefunded(id, deal.payer, deal.amount);
    }

    function _openDealOf(uint256 id) private view returns (Deal storage deal) {
        deal = deals[id];
        if (deal.status != Status.Open) revert NotOpen();
        if (deal.payer != msg.sender) revert NotPayer();
    }
}
