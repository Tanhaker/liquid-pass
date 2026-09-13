import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

/**
 * Marketplace x StreamRental.
 *
 * Each contract is correct on its own and has its own passing tests. The
 * question here is what happens when one pass is in both: listed on the
 * Marketplace, then escrowed into StreamRental.
 *
 * Nothing clears a listing when a pass changes hands through transferPass(),
 * openStream() does not check for one, and Marketplace.buy() moves the pass
 * BEFORE it pays the seller. So a stale listing on an escrowed pass names the
 * rental contract as the seller.
 */
describe("Marketplace x StreamRental", function () {
  const DAY = 24 * 60 * 60;
  const RATE = 1_000_000_000n;

  async function setup({ withEscrow }) {
    const [owner, attacker, issuer, renter] = await ethers.getSigners();

    const core = await (await ethers.getContractFactory("MockLiquidPass")).deploy();
    const market = await (await ethers.getContractFactory("Marketplace")).deploy(
      await core.getAddress(),
    );
    const rental = await (await ethers.getContractFactory("StreamRental")).deploy(
      await core.getAddress(),
    );
    await core.setMarketplace(await market.getAddress());

    if (withEscrow) {
      const escrow = await (await ethers.getContractFactory("MockEscrow")).deploy();
      await market.setEscrow(await escrow.getAddress());
    }

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await core.mint(owner.address, 1n, now + 30 * DAY, issuer.address);

    // 1. The owner lists the pass.
    await market.connect(owner).list(1n, ethers.parseEther("1"));

    // 2. Later, the owner rents it out instead -- in the correct order.
    await rental.connect(owner).openStream(1n, RATE);
    await core.connect(owner).transferPass(await rental.getAddress(), 1n);

    return { core, market, rental, owner, attacker, renter };
  }

  it("the listing survives the pass being escrowed", async function () {
    const { core, market, rental } = await setup({ withEscrow: false });

    expect(await core.ownerOf(1n)).to.equal(await rental.getAddress());
    // Still buyable as far as the Marketplace is concerned.
    expect(await market.currentPrice(1n)).to.be.greaterThan(0n);
  });

  /**
   * Today's deployment: no escrow is configured, so buy() pays the seller with
   * a plain transfer. StreamRental has no receive(), so that transfer reverts
   * and takes the whole purchase with it. The pass is safe -- but only because
   * of a missing function, not because anything checks.
   */
  it("TODAY: buying it out of the rental reverts, by accident", async function () {
    const { core, market, rental, attacker } = await setup({ withEscrow: false });
    const price = await market.currentPrice(1n);

    await expect(market.connect(attacker).buy(1n, { value: price })).to.be.reverted;
    expect(await core.ownerOf(1n)).to.equal(await rental.getAddress());
  });

  /**
   * The moment an escrow is set, the payout no longer touches the seller
   * directly, so nothing reverts. The attacker walks away with a pass that was
   * in escrow for its owner, and the proceeds are credited to a rental contract
   * that has no way to withdraw them.
   */
  it("WITH ESCROW: anyone can buy the pass out of the rental contract", async function () {
    const { core, market, rental, owner, attacker } = await setup({ withEscrow: true });
    const price = await market.currentPrice(1n);

    await expect(market.connect(attacker).buy(1n, { value: price })).to.not.be.reverted;

    // The pass is gone from escrow, to the attacker.
    expect(await core.ownerOf(1n)).to.equal(attacker.address);

    // Worse than a revert: reclaim() SUCCEEDS. It only hands the pass back if
    // the contract still holds it, so here it deletes the stream record and
    // returns nothing. The owner gets no error to tell them what happened.
    await expect(rental.connect(owner).reclaim(1n)).to.not.be.reverted;
    expect(await core.ownerOf(1n)).to.equal(attacker.address);
    expect((await rental.streams(1n)).owner).to.equal(ethers.ZeroAddress);
  });

  /**
   * The general form, reachable on the deployed contracts TODAY.
   *
   * Nothing about the rental case is special. Any transferPass() leaves a
   * listing behind, and buy() sells whoever currently holds the pass. A gift
   * goes to an ordinary wallet, which accepts the payout without reverting, so
   * there is no accidental guard: the recipient's pass is sold out from under
   * them at a price they never set.
   *
   * The dashboard's Gift panel promises the opposite -- "Any listing is
   * cleared -- the new owner didn't set that price" -- and does not disable
   * Gift on a listed pass.
   */
  it("TODAY: a gifted pass can be bought out from under the recipient", async function () {
    const [owner, recipient, attacker, issuer] = await ethers.getSigners();

    const core = await (await ethers.getContractFactory("MockLiquidPass")).deploy();
    const market = await (await ethers.getContractFactory("Marketplace")).deploy(
      await core.getAddress(),
    );
    await core.setMarketplace(await market.getAddress());
    // No escrow, exactly as deployed.

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await core.mint(owner.address, 7n, now + 30 * DAY, issuer.address);

    await market.connect(owner).list(7n, ethers.parseEther("1"));
    // Owner gifts it. They never unlisted, and nothing did it for them.
    await core.connect(owner).transferPass(recipient.address, 7n);
    expect(await core.ownerOf(7n)).to.equal(recipient.address);

    const price = await market.currentPrice(7n);
    const before = await ethers.provider.getBalance(recipient.address);

    await expect(market.connect(attacker).buy(7n, { value: price })).to.not.be.reverted;

    // The recipient lost a pass they never listed...
    expect(await core.ownerOf(7n)).to.equal(attacker.address);
    // ...and was paid a price the ORIGINAL owner chose.
    expect(await ethers.provider.getBalance(recipient.address)).to.be.greaterThan(before);
  });

  it("WITH ESCROW: an active renter loses access they paid for", async function () {
    const { market, rental, attacker, renter } = await setup({ withEscrow: true });

    await rental.connect(renter).startRent(1n, { value: RATE * 10_000n });
    expect(await rental.activeRenter(1n)).to.equal(renter.address);

    const price = await market.currentPrice(1n);
    await market.connect(attacker).buy(1n, { value: price });

    // activeRenter still names the renter, but the pass is no longer in the
    // contract -- the access it reports is backed by nothing.
    expect(await rental.activeRenter(1n)).to.equal(renter.address);
  });
});
