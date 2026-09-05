// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILiquidPass {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isActive(uint256 tokenId) external view returns (bool);
    function expiryOf(uint256 tokenId) external view returns (uint256);
    function issuerOf(uint256 tokenId) external view returns (address);
    function transferPass(address to, uint256 tokenId) external;
}

/**
 * Pay-per-second rental of a subscription pass.
 *
 * WHY A SEPARATE CONTRACT
 * -----------------------
 * The Rust core is 24,296 bytes against a 24 KB compressed Stylus limit --
 * roughly 280 bytes of headroom -- and is deployed and must not be changed.
 * So this lives beside it and drives it through the public interface.
 *
 * WHY NOT marketTransfer()
 * ------------------------
 * The core lets only its single registered marketplace call marketTransfer,
 * and repointing that would break the live Marketplace holding real listings.
 * So custody moves through transferPass(), which the owner may call for
 * themselves. Once this contract holds the pass it is the owner of record and
 * can hand it back the same way.
 *
 * THE ORDER MATTERS
 * -----------------
 * openStream() must be called BEFORE the pass is escrowed, while the caller
 * still owns it. If it were the other way round -- transfer first, then claim
 * the stream -- anyone watching the mempool could call openStream on a pass
 * that had just landed here, register themselves as its owner, and reclaim()
 * it. Requiring the caller to be the current on-chain owner closes that
 * window: only the real owner can open a stream, and only then can they
 * escrow it.
 *
 * WHAT ACCESS MEANS DURING A RENTAL
 * ---------------------------------
 * ownerOf() reports THIS CONTRACT while a pass is escrowed, not the renter.
 * Access is proved by activeRenter(), which is what the site and the extension
 * gate on. Stating that plainly matters: anything reading ownerOf() to decide
 * who may use a pass would get the wrong answer during a rental.
 */
contract StreamRental {
    ILiquidPass public immutable liquidPass;

    /// Royalty to the original issuer, in percent. Mirrors Marketplace.
    uint256 public constant ROYALTY_PERCENT = 10;

    struct Stream {
        /// Who escrowed the pass and gets it back. Zero means no stream.
        address owner;
        /// Wei charged per second of use.
        uint256 ratePerSecond;
        /// Current renter, or zero when idle.
        address renter;
        /// When the current rental began.
        uint256 startedAt;
        /// The renter's remaining funds for the current rental.
        uint256 deposit;
    }

    mapping(uint256 => Stream) public streams;

    /// Simple non-reentrancy flag. Settlement pays three parties.
    uint256 private _locked = 1;

    event StreamOpened(uint256 indexed tokenId, address indexed owner, uint256 ratePerSecond);
    event RateChanged(uint256 indexed tokenId, uint256 ratePerSecond);
    event RentStarted(uint256 indexed tokenId, address indexed renter, uint256 deposit, uint256 maxSeconds);
    event RentSettled(
        uint256 indexed tokenId,
        address indexed renter,
        uint256 secondsUsed,
        uint256 paid,
        uint256 royalty,
        uint256 refunded
    );
    event StreamClosed(uint256 indexed tokenId, address indexed owner);

    modifier nonReentrant() {
        require(_locked == 1, "Reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address _liquidPass) {
        require(_liquidPass != address(0), "Zero core");
        liquidPass = ILiquidPass(_liquidPass);
    }

    // ─── Owner side ──────────────────────────────────────────────────────

    /**
     * Declare a pass rentable, at a price per second.
     *
     * Call this FIRST, while you still own the pass, then transfer it here
     * with transferPass(streamRental, tokenId). See the note above on why the
     * order cannot be reversed.
     */
    function openStream(uint256 tokenId, uint256 ratePerSecond) external {
        require(ratePerSecond > 0, "Zero rate");
        require(liquidPass.ownerOf(tokenId) == msg.sender, "Not owner");
        require(liquidPass.isActive(tokenId), "Expired");

        Stream storage s = streams[tokenId];
        require(s.renter == address(0), "Rental in progress");

        s.owner = msg.sender;
        s.ratePerSecond = ratePerSecond;
        s.startedAt = 0;
        s.deposit = 0;

        emit StreamOpened(tokenId, msg.sender, ratePerSecond);
    }

    /// Reprice an idle stream.
    function setRate(uint256 tokenId, uint256 ratePerSecond) external {
        require(ratePerSecond > 0, "Zero rate");
        Stream storage s = streams[tokenId];
        require(s.owner == msg.sender, "Not stream owner");
        require(s.renter == address(0), "Rental in progress");

        s.ratePerSecond = ratePerSecond;
        emit RateChanged(tokenId, ratePerSecond);
    }

    /**
     * Take the pass back.
     *
     * Refuses while a rental is live; settle() it first. Anyone may settle a
     * stream that has run out, so an owner is never held hostage by a renter
     * who simply walks away.
     */
    function reclaim(uint256 tokenId) external nonReentrant {
        Stream storage s = streams[tokenId];
        require(s.owner == msg.sender, "Not stream owner");
        require(s.renter == address(0), "Rental in progress");

        delete streams[tokenId];
        emit StreamClosed(tokenId, msg.sender);

        // Only if this contract actually holds it -- an owner who opened a
        // stream and never escrowed the pass can still clear the entry.
        if (liquidPass.ownerOf(tokenId) == address(this)) {
            liquidPass.transferPass(msg.sender, tokenId);
        }
    }

    // ─── Renter side ─────────────────────────────────────────────────────

    /**
     * Begin renting. Everything sent is the budget; whatever is not used up is
     * refunded on settle().
     */
    function startRent(uint256 tokenId) external payable {
        Stream storage s = streams[tokenId];
        require(s.owner != address(0), "No stream");
        require(s.renter == address(0), "Already rented");
        require(msg.sender != s.owner, "Owner cannot rent");
        require(liquidPass.ownerOf(tokenId) == address(this), "Pass not escrowed");
        require(liquidPass.isActive(tokenId), "Expired");
        require(msg.value > 0, "No deposit");

        uint256 maxSeconds = _maxSeconds(tokenId, msg.value, s.ratePerSecond);
        require(maxSeconds > 0, "Deposit buys no time");

        s.renter = msg.sender;
        s.startedAt = block.timestamp;
        s.deposit = msg.value;

        emit RentStarted(tokenId, msg.sender, msg.value, maxSeconds);
    }

    /**
     * End a rental and pay out.
     *
     * The renter may stop at any moment. Anyone may stop a rental that has
     * already exhausted its deposit or outlived the pass, because by then
     * there is nothing left to decide and leaving it open would strand both
     * the pass and the money.
     */
    function settle(uint256 tokenId) external nonReentrant {
        Stream storage s = streams[tokenId];
        address renter = s.renter;
        require(renter != address(0), "Not rented");

        uint256 owed = _owed(tokenId, s);
        bool finished = owed >= s.deposit || block.timestamp >= liquidPass.expiryOf(tokenId);
        require(msg.sender == renter || finished, "Still running");

        uint256 deposit = s.deposit;
        uint256 refund = deposit - owed;
        uint256 royalty = (owed * ROYALTY_PERCENT) / 100;
        uint256 proceeds = owed - royalty;
        uint256 secondsUsed = s.ratePerSecond == 0 ? 0 : owed / s.ratePerSecond;
        address owner_ = s.owner;
        address issuer = liquidPass.issuerOf(tokenId);

        // EFFECTS before INTERACTIONS: the rental is over as far as this
        // contract is concerned before a single wei moves.
        s.renter = address(0);
        s.startedAt = 0;
        s.deposit = 0;

        emit RentSettled(tokenId, renter, secondsUsed, proceeds, royalty, refund);

        if (proceeds > 0) _pay(owner_, proceeds);
        if (royalty > 0) _pay(issuer, royalty);
        if (refund > 0) _pay(renter, refund);
    }

    // ─── Views ───────────────────────────────────────────────────────────

    /**
     * Who currently holds access, or zero.
     *
     * This -- not ownerOf() -- is what gates access during a rental. It stops
     * returning the renter the instant the deposit runs out or the pass
     * expires, without needing anyone to send a transaction first.
     */
    function activeRenter(uint256 tokenId) external view returns (address) {
        Stream storage s = streams[tokenId];
        if (s.renter == address(0)) return address(0);
        if (block.timestamp >= liquidPass.expiryOf(tokenId)) return address(0);
        if (_owed(tokenId, s) >= s.deposit) return address(0);
        return s.renter;
    }

    /// What the renter owes right now.
    function owedNow(uint256 tokenId) external view returns (uint256) {
        return _owed(tokenId, streams[tokenId]);
    }

    /// What the renter would get back if they stopped right now.
    function refundNow(uint256 tokenId) external view returns (uint256) {
        Stream storage s = streams[tokenId];
        return s.deposit - _owed(tokenId, s);
    }

    /// Seconds of use still funded, also capped by the pass's own expiry.
    function secondsRemaining(uint256 tokenId) external view returns (uint256) {
        Stream storage s = streams[tokenId];
        if (s.renter == address(0)) return 0;

        uint256 expiry = liquidPass.expiryOf(tokenId);
        if (block.timestamp >= expiry) return 0;

        uint256 owed = _owed(tokenId, s);
        if (owed >= s.deposit) return 0;

        uint256 funded = (s.deposit - owed) / s.ratePerSecond;
        uint256 untilExpiry = expiry - block.timestamp;
        return funded < untilExpiry ? funded : untilExpiry;
    }

    // ─── Internals ───────────────────────────────────────────────────────

    /**
     * Accrued cost, capped twice over.
     *
     * A renter can never owe more than they deposited, and time stops
     * accruing the moment the pass expires -- they are not charged for access
     * that no longer exists.
     */
    function _owed(uint256 tokenId, Stream storage s) private view returns (uint256) {
        if (s.renter == address(0)) return 0;

        uint256 endsAt = block.timestamp;
        uint256 expiry = liquidPass.expiryOf(tokenId);
        if (endsAt > expiry) endsAt = expiry;
        if (endsAt <= s.startedAt) return 0;

        uint256 owed = (endsAt - s.startedAt) * s.ratePerSecond;
        return owed > s.deposit ? s.deposit : owed;
    }

    function _maxSeconds(
        uint256 tokenId,
        uint256 deposit,
        uint256 ratePerSecond
    ) private view returns (uint256) {
        uint256 affordable = deposit / ratePerSecond;
        uint256 expiry = liquidPass.expiryOf(tokenId);
        if (block.timestamp >= expiry) return 0;
        uint256 untilExpiry = expiry - block.timestamp;
        return affordable < untilExpiry ? affordable : untilExpiry;
    }

    function _pay(address to, uint256 amount) private {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
