// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Kairos} from "./Kairos.sol";

contract KairosTest is Test {
    Kairos k;
    address seller = address(0xA11CE);
    address buyer = address(0xB0B);

    function setUp() public {
        k = new Kairos();
        vm.deal(seller, 10 ether);
        vm.deal(buyer, 100 ether);
    }

    function test_create_and_buy_mid_curve() public {
        vm.prank(seller);
        uint256 id = k.create("pass", 10 ether, 1 ether, 100);
        assertEq(id, 0);
        assertEq(k.price(0), 10 ether);

        vm.roll(block.number + 50);
        uint256 p = k.price(0);
        assertEq(p, 5.5 ether);

        vm.prank(buyer);
        k.buy{value: p}(0);

        (Kairos.Auction memory a,) = k.getAuction(0);
        assertEq(a.buyer, buyer);
        assertEq(k.accruedFees(), (5.5 ether * 200) / 10_000);
    }

    function test_underpay_reverts() public {
        vm.prank(seller);
        k.create("x", 5 ether, 1 ether, 40);
        vm.prank(buyer);
        vm.expectRevert(bytes("underpay"));
        k.buy{value: 0.1 ether}(0);
    }
}
