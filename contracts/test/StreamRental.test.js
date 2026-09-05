import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

/**
 * StreamRental.
 *
 * The interesting cases are the ones where money or custody could go wrong:
 * the front-running window on openStream, a renter who walks away, a pass that
 * expires mid-rental, and a deposit that runs out.
 */
describe("StreamRental", function () {
  const DAY = 24 * 60 * 60;
  const RATE = 1_000_000_000n; // 1 gwei per second

  async function deploy() {
    const [owner, renter, issuer, stranger] = await ethers.getSigners();

    const Core = await ethers.getContractFactory("MockLiquidPass");
    const core = await Core.deploy();
    await core.waitForDeployment();

    const Rental = await ethers.getContractFactory("StreamRental");
    const rental = await Rental.deploy(await core.getAddress());
    await rental.waitForDeployment();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const expiry = now + 30 * DAY;
    await core.mint(owner.address, 1n, expiry, issuer.address);

    return { core, rental, owner, renter, issuer, stranger, expiry };
  }

  /** The intended flow: declare while you own it, then escrow it. */
  async function openAndEscrow(core, rental, owner, tokenId = 1n, rate = RATE) {
    await rental.connect(owner).openStream(tokenId, rate);
    await core.connect(owner).transferPass(await rental.getAddress(), tokenId);
  }

  describe("opening", function () {
    it("only the current owner can open a stream", async function () {
      const { rental, stranger } = await deploy();
      await expect(rental.connect(stranger).openStream(1n, RATE)).to.be.revertedWith("Not owner");
    });

    it("rejects a zero rate", async function () {
      const { rental, owner } = await deploy();
      await expect(rental.connect(owner).openStream(1n, 0)).to.be.revertedWith("Zero rate");
    });

    /**
     * The front-running case the ordering exists to prevent. If a stream could
     * be claimed after the pass arrived, whoever called first would become its
     * owner and could reclaim() someone else's pass.
     */
    it("a stranger cannot claim a pass that was escrowed without a stream", async function () {
      const { core, rental, owner, stranger } = await deploy();
      await core.connect(owner).transferPass(await rental.getAddress(), 1n);

      // The pass is sitting in the contract with no stream. The stranger is
      // not the owner of record on the core -- the contract is -- so they
      // cannot open a stream over it.
      await expect(rental.connect(stranger).openStream(1n, RATE)).to.be.revertedWith("Not owner");
    });
  });

  describe("renting", function () {
    it("charges per second and splits 90/10 on settle", async function () {
      const { core, rental, owner, renter, issuer } = await deploy();
      await openAndEscrow(core, rental, owner);

      const deposit = RATE * 1000n;
      await rental.connect(renter).startRent(1n, { value: deposit });

      await ethers.provider.send("evm_increaseTime", [100]);
      await ethers.provider.send("evm_mine", []);

      const ownerBefore = await ethers.provider.getBalance(owner.address);
      const issuerBefore = await ethers.provider.getBalance(issuer.address);

      const tx = await rental.connect(renter).settle(1n);
      const receipt = await tx.wait();

      const event = receipt.logs
        .map((l) => {
          try {
            return rental.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((e) => e && e.name === "RentSettled");

      const used = event.args.secondsUsed;
      const paid = event.args.paid;
      const royalty = event.args.royalty;

      // ~101s of accrual (the settle transaction advances the clock by one).
      expect(used).to.be.greaterThanOrEqual(100n);
      expect(used).to.be.lessThanOrEqual(102n);

      const owed = used * RATE;
      expect(royalty).to.equal(owed / 10n);
      expect(paid).to.equal(owed - owed / 10n);

      expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBefore + paid);
      expect(await ethers.provider.getBalance(issuer.address)).to.equal(issuerBefore + royalty);
    });

    it("refunds the unused deposit", async function () {
      const { core, rental, owner, renter } = await deploy();
      await openAndEscrow(core, rental, owner);

      const deposit = RATE * 1000n;
      await rental.connect(renter).startRent(1n, { value: deposit });
      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);

      const owed = await rental.owedNow(1n);
      const refund = await rental.refundNow(1n);
      expect(owed + refund).to.equal(deposit);
      expect(refund).to.be.greaterThan(0n);
    });

    it("the owner cannot rent their own pass", async function () {
      const { core, rental, owner } = await deploy();
      await openAndEscrow(core, rental, owner);
      await expect(
        rental.connect(owner).startRent(1n, { value: RATE * 10n }),
      ).to.be.revertedWith("Owner cannot rent");
    });

    it("refuses to start before the pass is escrowed", async function () {
      const { rental, owner, renter } = await deploy();
      await rental.connect(owner).openStream(1n, RATE);
      await expect(
        rental.connect(renter).startRent(1n, { value: RATE * 10n }),
      ).to.be.revertedWith("Pass not escrowed");
    });

    it("refuses a deposit that buys no time", async function () {
      const { core, rental, owner, renter } = await deploy();
      await openAndEscrow(core, rental, owner);
      await expect(rental.connect(renter).startRent(1n, { value: 1n })).to.be.revertedWith(
        "Deposit buys no time",
      );
    });
  });

  describe("limits", function () {
    it("never charges more than the deposit", async function () {
      const { core, rental, owner, renter } = await deploy();
      await openAndEscrow(core, rental, owner);

      const deposit = RATE * 60n; // one minute of funding
      await rental.connect(renter).startRent(1n, { value: deposit });

      await ethers.provider.send("evm_increaseTime", [10 * DAY]);
      await ethers.provider.send("evm_mine", []);

      expect(await rental.owedNow(1n)).to.equal(deposit);
      expect(await rental.refundNow(1n)).to.equal(0n);
    });

    it("stops charging when the pass expires", async function () {
      const { core, rental, owner, renter, expiry } = await deploy();
      await openAndEscrow(core, rental, owner);

      const deposit = RATE * BigInt(60 * DAY); // more than the pass has left
      await rental.connect(renter).startRent(1n, { value: deposit });

      const startedAt = (await ethers.provider.getBlock("latest")).timestamp;
      await ethers.provider.send("evm_increaseTime", [40 * DAY]);
      await ethers.provider.send("evm_mine", []);

      // Accrual halts at expiry, not at the current time.
      expect(await rental.owedNow(1n)).to.equal(BigInt(expiry - startedAt) * RATE);
    });

    it("access lapses the moment the deposit runs out", async function () {
      const { core, rental, owner, renter } = await deploy();
      await openAndEscrow(core, rental, owner);

      await rental.connect(renter).startRent(1n, { value: RATE * 60n });
      expect(await rental.activeRenter(1n)).to.equal(renter.address);

      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);

      expect(await rental.activeRenter(1n)).to.equal(ethers.ZeroAddress);
      expect(await rental.secondsRemaining(1n)).to.equal(0n);
    });
  });

  describe("settlement rights", function () {
    it("a third party cannot cut a running rental short", async function () {
      const { core, rental, owner, renter, stranger } = await deploy();
      await openAndEscrow(core, rental, owner);
      await rental.connect(renter).startRent(1n, { value: RATE * 10_000n });

      await expect(rental.connect(stranger).settle(1n)).to.be.revertedWith("Still running");
    });

    /**
     * An owner must never be stranded by a renter who simply stops caring.
     */
    it("anyone can settle once the deposit is spent", async function () {
      const { core, rental, owner, renter, stranger } = await deploy();
      await openAndEscrow(core, rental, owner);
      await rental.connect(renter).startRent(1n, { value: RATE * 60n });

      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);

      await expect(rental.connect(stranger).settle(1n)).to.not.be.reverted;
      expect((await rental.streams(1n)).renter).to.equal(ethers.ZeroAddress);
    });
  });

  describe("custody", function () {
    it("returns the pass on reclaim", async function () {
      const { core, rental, owner } = await deploy();
      await openAndEscrow(core, rental, owner);
      expect(await core.ownerOf(1n)).to.equal(await rental.getAddress());

      await rental.connect(owner).reclaim(1n);
      expect(await core.ownerOf(1n)).to.equal(owner.address);
      expect((await rental.streams(1n)).owner).to.equal(ethers.ZeroAddress);
    });

    it("refuses to reclaim mid-rental", async function () {
      const { core, rental, owner, renter } = await deploy();
      await openAndEscrow(core, rental, owner);
      await rental.connect(renter).startRent(1n, { value: RATE * 10_000n });

      await expect(rental.connect(owner).reclaim(1n)).to.be.revertedWith("Rental in progress");
    });

    it("only the stream owner can reclaim", async function () {
      const { core, rental, owner, stranger } = await deploy();
      await openAndEscrow(core, rental, owner);
      await expect(rental.connect(stranger).reclaim(1n)).to.be.revertedWith("Not stream owner");
    });

    it("a full cycle leaves no dust in the contract", async function () {
      const { core, rental, owner, renter } = await deploy();
      await openAndEscrow(core, rental, owner);

      await rental.connect(renter).startRent(1n, { value: RATE * 500n });
      await ethers.provider.send("evm_increaseTime", [50]);
      await ethers.provider.send("evm_mine", []);
      await rental.connect(renter).settle(1n);

      expect(await ethers.provider.getBalance(await rental.getAddress())).to.equal(0n);
    });
  });

  describe("payout failure", function () {
    it("surfaces a refusing recipient instead of losing the money", async function () {
      const [owner, renter, , stranger] = await ethers.getSigners();

      const Core = await ethers.getContractFactory("MockLiquidPass");
      const core = await Core.deploy();
      const Rental = await ethers.getContractFactory("StreamRental");
      const rental = await Rental.deploy(await core.getAddress());
      const Reject = await ethers.getContractFactory("RejectingReceiver");
      const bad = await Reject.deploy();

      const now = (await ethers.provider.getBlock("latest")).timestamp;
      // Issuer is a contract that refuses payment.
      await core.mint(owner.address, 1n, now + 30 * DAY, await bad.getAddress());

      await rental.connect(owner).openStream(1n, RATE);
      await core.connect(owner).transferPass(await rental.getAddress(), 1n);
      await rental.connect(renter).startRent(1n, { value: RATE * 1000n });

      await ethers.provider.send("evm_increaseTime", [100]);
      await ethers.provider.send("evm_mine", []);

      await expect(rental.connect(renter).settle(1n)).to.be.revertedWith("Transfer failed");
      // The rental is untouched, so it can be settled once the issuer can be paid.
      expect((await rental.streams(1n)).renter).to.equal(renter.address);
      void stranger;
    });
  });
});
