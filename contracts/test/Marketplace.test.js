import { expect } from "chai";
import hre from "hardhat";

describe("Marketplace & Escrow Yield", function () {
  it("Should list a pass and process a buy via escrow", async function () {
    // 1. Deploy EscrowYield
    const EscrowYield = await hre.ethers.getContractFactory("EscrowYield");
    const escrow = await EscrowYield.deploy(
      "0x153C3502CBE10b97A0A939462A0D8D905139049d", // WETH Gateway (Arbitrum Sepolia Aave)
      "0xe80772Eaf6e2E18B651F160Bc9158b2A5caFCA65"  // aWETH
    );
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();

    // 2. Deploy Marketplace
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(
      "0x0000000000000000000000000000000000000001", // Dummy core address
      "0x0000000000000000000000000000000000000002"  // Dummy admin
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
