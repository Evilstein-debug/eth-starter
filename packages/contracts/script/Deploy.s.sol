// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {SimpleEscrow} from "../src/SimpleEscrow.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";

/// @notice Deploys every contract, configures it, and writes addresses to
///         packages/shared/deployments/<chainId>.json (read by `pnpm codegen`).
/// @dev    The signer comes from the CLI (`--private-key` or `--account`), never from code.
contract Deploy is Script {
    function run() external {
        uint256 startBlock = block.number;
        int256 initialPrice = int256(vm.envOr("INITIAL_ORACLE_PRICE", uint256(2000e8)));
        uint256 deployerMint = vm.envOr("DEPLOYER_MINT", uint256(1_000_000e6));

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        MockERC20 token = new MockERC20("Mock USD", "mUSD");
        MockOracle oracle = new MockOracle(deployer, 8, initialPrice);
        SimpleEscrow escrow = new SimpleEscrow(token);

        // Configure: seed the deployer with test tokens.
        token.mint(deployer, deployerMint);
        vm.stopBroadcast();

        // A dry run (no --broadcast) must not overwrite real addresses.
        if (!vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            console.log("Dry run: not writing deployments file");
            return;
        }

        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeUint(key, "startBlock", startBlock);
        vm.serializeAddress(key, "deployer", deployer);
        vm.serializeAddress(key, "MockERC20", address(token));
        vm.serializeAddress(key, "MockOracle", address(oracle));
        string memory json = vm.serializeAddress(key, "SimpleEscrow", address(escrow));

        string memory path =
            string.concat("../shared/deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console.log("Wrote", path);
    }
}
