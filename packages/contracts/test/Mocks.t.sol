// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";

contract MocksTest is Test {
    function test_mockERC20_has6DecimalsAndMints() public {
        MockERC20 token = new MockERC20("Mock USD", "mUSD");
        assertEq(token.decimals(), 6);
        token.mint(address(this), 5e6);
        assertEq(token.balanceOf(address(this)), 5e6);
    }

    function test_mockERC20_permit() public {
        MockERC20 token = new MockERC20("Mock USD", "mUSD");
        (address owner, uint256 key) = makeAddrAndKey("owner");
        address spender = makeAddr("spender");
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                owner,
                spender,
                1e6,
                token.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);

        token.permit(owner, spender, 1e6, deadline, v, r, s);
        assertEq(token.allowance(owner, spender), 1e6);
    }

    function test_mockOracle_ownerSetsPrice() public {
        MockOracle oracle = new MockOracle(address(this), 8, 2000e8);
        oracle.setPrice(2500e8);
        (uint80 roundId, int256 answer,,,) = oracle.latestRoundData();
        assertEq(answer, 2500e8);
        assertEq(roundId, 2);
    }

    function test_mockOracle_onlyOwner() public {
        MockOracle oracle = new MockOracle(address(this), 8, 2000e8);
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        oracle.setPrice(1);
    }
}
