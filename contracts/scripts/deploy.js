import hre from "hardhat";

async function main() {
  const liquidPassAddress = "0xac20ef73723e7c620df1024eb04cc0b71fca1055"; // Core Rust contract
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(liquidPassAddress);
  
  await marketplace.waitForDeployment();
  
  console.log("Marketplace deployed to:", await marketplace.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
