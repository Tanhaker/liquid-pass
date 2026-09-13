import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

/**
 * IssuerRequests only records requests. What matters is that it cannot be
 * used to become an issuer, that only the core's admin can clear someone
 * else's request, and that bad input is refused.
 */
describe("IssuerRequests", function () {
  async function deploy() {
    const [admin, company, other] = await ethers.getSigners();
    const Core = await ethers.getContractFactory("MockIssuerCore");
    const core = await Core.connect(admin).deploy();
    await core.waitForDeployment();
    const Requests = await ethers.getContractFactory("IssuerRequests");
    const inbox = await Requests.deploy(await core.getAddress());
    await inbox.waitForDeployment();
    return { core, inbox, admin, company, other };
  }

  it("records a request and lists the requester once", async function () {
    const { inbox, company } = await deploy();
    await expect(inbox.connect(company).request("Acme AI", "Monthly plans"))
      .to.emit(inbox, "AccessRequested")
      .withArgs(company.address, "Acme AI", "Monthly plans");

    const r = await inbox.requests(company.address);
    expect(r.company).to.equal("Acme AI");
    expect(r.note).to.equal("Monthly plans");
    expect(r.requestedAt).to.be.greaterThan(0n);

    // Refiling replaces the request without a second list entry.
    await inbox.connect(company).request("Acme AI Inc", "");
    expect(await inbox.requesterCount()).to.equal(1n);
    expect((await inbox.requests(company.address)).company).to.equal("Acme AI Inc");
  });

  it("grants nothing: the requester is still not an issuer", async function () {
    const { core, inbox, company } = await deploy();
    await inbox.connect(company).request("Acme AI", "");
    expect(await core.isIssuer(company.address)).to.equal(false);
  });

  it("refuses a request from an existing issuer", async function () {
    const { core, inbox, admin, company } = await deploy();
    await core.connect(admin).setIssuer(company.address, true);
    await expect(inbox.connect(company).request("Acme AI", "")).to.be.revertedWith("Already an issuer");
  });

  it("validates the company name and note length", async function () {
    const { inbox, company } = await deploy();
    await expect(inbox.connect(company).request("", "")).to.be.revertedWith("Company name 1-64 bytes");
    await expect(inbox.connect(company).request("x".repeat(65), "")).to.be.revertedWith("Company name 1-64 bytes");
    await expect(inbox.connect(company).request("Acme", "y".repeat(281))).to.be.revertedWith("Note too long");
    await inbox.connect(company).request("x".repeat(64), "y".repeat(280));
  });

  it("lets a requester withdraw only their own open request", async function () {
    const { inbox, company, other } = await deploy();
    await expect(inbox.connect(company).withdraw()).to.be.revertedWith("No open request");
    await inbox.connect(company).request("Acme AI", "");
    await expect(inbox.connect(company).withdraw()).to.emit(inbox, "RequestWithdrawn").withArgs(company.address);
    expect((await inbox.requests(company.address)).requestedAt).to.equal(0n);
    // The list keeps its history; only the request is cleared.
    expect(await inbox.requesterCount()).to.equal(1n);
    await expect(inbox.connect(other).withdraw()).to.be.revertedWith("No open request");
  });

  it("only the core admin can dismiss someone else's request", async function () {
    const { inbox, admin, company, other } = await deploy();
    await inbox.connect(company).request("Acme AI", "");
    await expect(inbox.connect(other).dismiss(company.address)).to.be.revertedWith("Only the core admin");
    await expect(inbox.connect(admin).dismiss(company.address))
      .to.emit(inbox, "RequestDismissed")
      .withArgs(company.address, admin.address);
    await expect(inbox.connect(admin).dismiss(company.address)).to.be.revertedWith("No open request");
  });

  it("rejects a zero core address at deploy", async function () {
    const Requests = await ethers.getContractFactory("IssuerRequests");
    await expect(Requests.deploy(ethers.ZeroAddress)).to.be.revertedWith("Core required");
  });
});
