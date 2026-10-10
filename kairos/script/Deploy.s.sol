// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Kairos} from "../contracts/Kairos.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        Kairos k = new Kairos();
        console2.log("Kairos deployed at:", address(k));
        vm.stopBroadcast();
    }
}
