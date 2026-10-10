// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Kairos — Dutch auctions that reprice every Monad block
/// @notice Clearing price is a pure function of block.number. No oracle, no keeper.
contract Kairos {
    uint16 public constant FEE_BPS = 200; // 2%
    address public owner;
    uint256 public accruedFees;

    struct Auction {
        address seller;
        string title;
        uint96 startPrice;
        uint96 floorPrice;
        uint64 startBlock;
        uint64 endBlock;
        address buyer;
    }

    Auction[] public auctions;

    event Listed(
        uint256 indexed id,
        address indexed seller,
        string title,
        uint96 startPrice,
        uint96 floorPrice,
        uint64 endBlock
    );
    event Cleared(uint256 indexed id, address indexed buyer, uint256 price, uint256 fee);

    constructor() {
        owner = msg.sender;
    }

    function create(
        string calldata title,
        uint96 startPrice,
        uint96 floorPrice,
        uint64 durationBlocks
    ) external returns (uint256 id) {
        require(bytes(title).length > 0 && bytes(title).length <= 80, "title");
        require(startPrice > floorPrice, "curve");
        require(durationBlocks >= 20 && durationBlocks <= 50_000, "duration");

        uint64 start = uint64(block.number);
        id = auctions.length;
        auctions.push(
            Auction({
                seller: msg.sender,
                title: title,
                startPrice: startPrice,
                floorPrice: floorPrice,
                startBlock: start,
                endBlock: start + durationBlocks,
                buyer: address(0)
            })
        );
        emit Listed(id, msg.sender, title, startPrice, floorPrice, start + durationBlocks);
    }

    function price(uint256 id) public view returns (uint256) {
        Auction memory a = auctions[id];
        if (block.number <= a.startBlock) return a.startPrice;
        if (block.number >= a.endBlock) return a.floorPrice;
        uint256 span = uint256(a.endBlock - a.startBlock);
        uint256 elapsed = uint256(block.number - a.startBlock);
        uint256 drop = (uint256(a.startPrice) - uint256(a.floorPrice)) * elapsed / span;
        return uint256(a.startPrice) - drop;
    }

    function buy(uint256 id) external payable {
        Auction storage a = auctions[id];
        require(a.buyer == address(0), "sold");
        require(block.number <= a.endBlock, "expired");

        uint256 p = price(id);
        require(msg.value >= p, "underpay");

        a.buyer = msg.sender;
        uint256 fee = p * FEE_BPS / 10_000;
        accruedFees += fee;

        (bool ok,) = a.seller.call{value: p - fee}("");
        require(ok, "seller pay");

        uint256 refund = msg.value - p;
        if (refund > 0) {
            (bool ok2,) = msg.sender.call{value: refund}("");
            require(ok2, "refund");
        }

        emit Cleared(id, msg.sender, p, fee);
    }

    function withdrawFees() external {
        require(msg.sender == owner, "owner");
        uint256 amt = accruedFees;
        accruedFees = 0;
        (bool ok,) = owner.call{value: amt}("");
        require(ok, "withdraw");
    }

    function count() external view returns (uint256) {
        return auctions.length;
    }

    function getAuction(uint256 id) external view returns (Auction memory a, uint256 livePrice) {
        a = auctions[id];
        livePrice = price(id);
    }
}
