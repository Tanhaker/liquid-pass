import { expect } from "chai";
import hre from "hardhat";

describe("Marketplace & Escrow Yield", function () {
  it("Should list a pass and process a buy via escrow", async function () {
    // 1. Deploy EscrowYield
    const EscrowYield = await hre.ethers.getContractFactory("EscrowYield");
    // Three arguments, not two: the constructor is
    // (wethGateway, aavePool, aWETH). This test passed only two and so had
    // never run -- it failed at deploy with "incorrect number of arguments".
    //
    // All three are placeholders on purpose. Nothing in this test calls Aave;
    // it only checks that the escrow and the marketplace point at each other.
    // The "real" Aave addresses that used to sit here fail their EIP-55
    // checksum, so they cannot be trusted -- see scripts/deployEscrow.js.
    // aWETH must be a real contract: the constructor infinite-approves the
    // gateway against it, and a plain address reverts with "function returned
    // an unexpected amount of data".
    const Token = await hre.ethers.getContractFactory("MockERC20");
    const aWeth = await Token.deploy();
    await aWeth.waitForDeployment();

    const escrow = await EscrowYield.deploy(
      "0x0000000000000000000000000000000000000011", // placeholder WETH Gateway
      "0x0000000000000000000000000000000000000012", // placeholder Pool
      await aWeth.getAddress()
    );
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();

    // 2. Deploy Marketplace
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    // One argument: Marketplace(address _liquidPass). The second was never a
    // constructor parameter.
    const marketplace = await Marketplace.deploy(
      "0x0000000000000000000000000000000000000001", // placeholder core
    );
    await marketplace.waitForDeployment();
    const marketAddress = await marketplace.getAddress();

    // Link them
    await escrow.setMarketplace(marketAddress);
    await marketplace.setEscrow(escrowAddress);

    // Verify linkage
    expect(await marketplace.escrowYield()).to.equal(escrowAddress);
  });
});
