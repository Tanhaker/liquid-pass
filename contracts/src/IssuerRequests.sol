// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILiquidPassIssuers {
    function admin() external view returns (address);
    function isIssuer(address who) external view returns (bool);
}

/**
 * A public inbox for issuer-access requests.
 *
 * Only the core's admin can authorise an issuer, through setIssuer() on the
 * Rust core, and there was no way for a SaaS company to ask. The core cannot
 * be changed, so the request lives here instead. This contract grants NOTHING:
 * it records who asked and why. Approval is still the admin calling the
 * core's own setIssuer(), exactly as before.
 *
 * Deliberately holds no funds and has no privileged path into the core.
 *
 * Testnet caveats, stated rather than hidden: anyone can file a request, so
 * the requester list can be spammed. Each address holds at most one request
 * and the list only ever grows by one entry per distinct address; readers
 * should page through it rather than assume it is small.
 */
contract IssuerRequests {
    ILiquidPassIssuers public immutable liquidPass;

    uint256 public constant MAX_COMPANY = 64;
    uint256 public constant MAX_NOTE = 280;

    struct Request {
        string company;
        string note;
        /// Zero when there is no open request.
        uint64 requestedAt;
    }

    mapping(address => Request) public requests;

    /// Every address that has ever filed, in order. Open requests are the
    /// entries whose `requests[addr].requestedAt` is non-zero.
    address[] public requesters;
    mapping(address => bool) private _seen;

    event AccessRequested(address indexed requester, string company, string note);
    event RequestWithdrawn(address indexed requester);
    event RequestDismissed(address indexed requester, address indexed admin);

    constructor(address core) {
        require(core != address(0), "Core required");
        liquidPass = ILiquidPassIssuers(core);
    }

    /// File, or replace, the caller's request.
    function request(string calldata company, string calldata note) external {
        require(!liquidPass.isIssuer(msg.sender), "Already an issuer");
        uint256 companyLen = bytes(company).length;
        require(companyLen > 0 && companyLen <= MAX_COMPANY, "Company name 1-64 bytes");
        require(bytes(note).length <= MAX_NOTE, "Note too long");

        requests[msg.sender] = Request(company, note, uint64(block.timestamp));
        if (!_seen[msg.sender]) {
            _seen[msg.sender] = true;
            requesters.push(msg.sender);
        }
        emit AccessRequested(msg.sender, company, note);
    }

    /// Cancel the caller's own open request.
    function withdraw() external {
        require(requests[msg.sender].requestedAt != 0, "No open request");
        delete requests[msg.sender];
        emit RequestWithdrawn(msg.sender);
    }

    /// The core's admin clears a request, after approving it or to decline it.
    function dismiss(address requester) external {
        require(msg.sender == liquidPass.admin(), "Only the core admin");
        require(requests[requester].requestedAt != 0, "No open request");
        delete requests[requester];
        emit RequestDismissed(requester, msg.sender);
    }

    function requesterCount() external view returns (uint256) {
        return requesters.length;
    }
}
