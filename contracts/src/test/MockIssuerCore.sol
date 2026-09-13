// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * The two core functions IssuerRequests reads, for tests only. The real core
 * is a Stylus contract that cannot run on the Hardhat EVM.
 */
contract MockIssuerCore {
    address public admin;
    mapping(address => bool) public isIssuer;

    constructor() {
        admin = msg.sender;
    }

    /// Mirrors the core's rule: only the admin may change issuer access.
    function setIssuer(address who, bool allowed) external {
        require(msg.sender == admin, "not admin");
        isIssuer[who] = allowed;
    }
}
