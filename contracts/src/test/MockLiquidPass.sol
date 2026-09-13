// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * A stand-in for the Rust core, for tests only.
 *
 * The real core is a Stylus WASM contract and cannot run on the Hardhat EVM,
 * so the parts StreamRental actually touches are reimplemented here with the
 * same semantics -- in particular transferPass(), which is owner-only and is
 * the mechanism the rental contract depends on for custody.
 */
contract MockLiquidPass {
    mapping(uint256 => address) private _owners;
    mapping(uint256 => uint256) private _expiries;
    mapping(uint256 => address) private _issuers;

    function mint(address to, uint256 tokenId, uint256 expiry, address issuer) external {
        _owners[tokenId] = to;
        _expiries[tokenId] = expiry;
        _issuers[tokenId] = issuer;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }

    function expiryOf(uint256 tokenId) external view returns (uint256) {
        return _expiries[tokenId];
    }

    function issuerOf(uint256 tokenId) external view returns (address) {
        return _issuers[tokenId];
    }

    function isActive(uint256 tokenId) external view returns (bool) {
        return _expiries[tokenId] > block.timestamp;
    }

    /// Owner-only, exactly as in the Rust core.
    function transferPass(address to, uint256 tokenId) external {
        require(_owners[tokenId] == msg.sender, "Not owner");
        _owners[tokenId] = to;
    }

    address public marketplace;

    function setMarketplace(address m) external {
        marketplace = m;
    }

    /// Marketplace-only, mirroring market_transfer in the Rust core: the caller
    /// must be the registered marketplace and `from` must be the current owner.
    /// Nothing else is checked -- in particular, not whether `from` is a
    /// contract holding the pass in escrow for someone else.
    function marketTransfer(address from, address to, uint256 tokenId) external {
        require(msg.sender == marketplace, "Not marketplace");
        require(_owners[tokenId] == from, "Not owner");
        _owners[tokenId] = to;
    }
}

/// Accepts depositYield, standing in for EscrowYield without the Aave calls.
contract MockEscrow {
    mapping(address => uint256) public lockedBalances;

    function depositYield(address seller) external payable {
        lockedBalances[seller] += msg.value;
    }
}

/// Refuses payment, to prove settlement surfaces the failure rather than
/// silently losing funds.
contract RejectingReceiver {
    receive() external payable {
        revert("nope");
    }
}

/**
 * Minimal ERC20, enough for EscrowYield's constructor.
 *
 * That constructor infinite-approves the WETH gateway against aWETH, so the
 * aWETH argument has to be a real contract that answers approve(). Passing a
 * plain address makes deployment revert with "function returned an unexpected
 * amount of data", which is what stopped the Marketplace test from running.
 */
contract MockERC20 {
    mapping(address => mapping(address => uint256)) public allowance;

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}
