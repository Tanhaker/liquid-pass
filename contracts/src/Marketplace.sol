// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILiquidPass {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isActive(uint256 tokenId) external view returns (bool);
    function expiryOf(uint256 tokenId) external view returns (uint256);
    function issuerOf(uint256 tokenId) external view returns (address);
    function marketTransfer(address from, address to, uint256 tokenId) external;
}

interface IEscrowYield {
    function depositYield(address seller) external payable;
}

contract Marketplace {
    ILiquidPass public liquidPass;
    IEscrowYield public escrowYield;

    struct Listing {
        uint256 openingPrice;
        uint256 listedAt;
    }

    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Unlisted(uint256 indexed tokenId, address indexed seller);
    event Bought(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, uint256 royalty);

    constructor(address _liquidPass) {
        liquidPass = ILiquidPass(_liquidPass);
    }

    function setEscrow(address _escrow) external {
        require(address(escrowYield) == address(0), "Escrow already set");
        escrowYield = IEscrowYield(_escrow);
    }

    function list(uint256 tokenId, uint256 price) external {
        require(liquidPass.ownerOf(tokenId) == msg.sender, "Not owner");
        require(liquidPass.isActive(tokenId), "Expired");
        require(price > 0, "Zero price");

        listings[tokenId] = Listing({
            openingPrice: price,
            listedAt: block.timestamp
        });

        emit Listed(tokenId, msg.sender, price);
    }

    function unlist(uint256 tokenId) external {
        require(liquidPass.ownerOf(tokenId) == msg.sender, "Not owner");
        delete listings[tokenId];
        emit Unlisted(tokenId, msg.sender);
    }

    function currentPrice(uint256 tokenId) public view returns (uint256) {
        Listing memory l = listings[tokenId];
        if (l.openingPrice == 0) return 0;
        
        uint256 expiry = liquidPass.expiryOf(tokenId);
        if (block.timestamp >= expiry || expiry <= l.listedAt) return 0;
        
        return l.openingPrice * (expiry - block.timestamp) / (expiry - l.listedAt);
    }

    function openingPrice(uint256 tokenId) public view returns (uint256) {
        return listings[tokenId].openingPrice;
    }

    function buy(uint256 tokenId) external payable {
        uint256 price = currentPrice(tokenId);
        require(price > 0, "Not listed or no time left");
        require(liquidPass.isActive(tokenId), "Expired");
        require(msg.value >= price, "Wrong value");

        address seller = liquidPass.ownerOf(tokenId);
        require(seller != msg.sender, "Already owner");

        address issuer = liquidPass.issuerOf(tokenId);
        
        // Clear listing
        delete listings[tokenId];

        uint256 royalty = price / 10;
        uint256 proceeds = price - royalty;
        uint256 refund = msg.value - price;

        // Transfer token
        liquidPass.marketTransfer(seller, msg.sender, tokenId);

        // Payouts: Send proceeds to the Escrow to earn Aave Yield!
        if (address(escrowYield) != address(0)) {
            escrowYield.depositYield{value: proceeds}(seller);
        } else {
            payable(seller).transfer(proceeds);
        }
        
        payable(issuer).transfer(royalty);
        if (refund > 0) {
            payable(msg.sender).transfer(refund);
        }

        emit Bought(tokenId, msg.sender, seller, price, royalty);
    }
}
