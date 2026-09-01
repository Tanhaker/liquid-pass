import hre from "hardhat";

async function main() {
  const marketplaceAddress = "0x00Ce3047BcF4Ddb85E3af3fCA2Ba17d97F2dF4e1"; 
  
  // Aave V3 Arbitrum Sepolia Addresses
  const pool = "0xB50201558B00496A145fE76f7424749556E326D8";
  const wethGateway = "0x153C3502CBE10b97A0A939462A0D8D905139049d";
  const aWeth = "0xe80772Eaf6e2E18B651F160Bc9158b2A5caFCA65";

  console.log("Deploying EscrowYield...");
  const EscrowYield = await hre.ethers.getContractFactory("EscrowYield");
  const escrow = await EscrowYield.deploy(wethGateway, pool, aWeth);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("EscrowYield deployed to:", escrowAddress);

  console.log("Linking EscrowYield to Marketplace...");
  // 1. Tell Escrow about the Marketplace
  let tx = await escrow.setMarketplace(marketplaceAddress);
  await tx.wait();

  // 2. Tell Marketplace about the Escrow
  console.log("Linking Marketplace to EscrowYield...");
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = Marketplace.attach(marketplaceAddress);
  tx = await marketplace.setEscrow(escrowAddress);
  await tx.wait();

  console.log("Done! Escrow linked successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
