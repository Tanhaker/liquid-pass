import hre from "hardhat";

async function main() {
  const liquidPassAddress = "0xac20ef73723e7c620df1024eb04cc0b71fca1055"; // Core Rust contract
  const marketplaceAddress = "0x00Ce3047BcF4Ddb85E3af3fCA2Ba17d97F2dF4e1"; // New Marketplace contract
  
  const abi = [
    "function set_marketplace(address market) external"
  ];
  
  const [signer] = await hre.ethers.getSigners();
  const liquidPass = new hre.ethers.Contract(liquidPassAddress, abi, signer);
  
  console.log("Setting marketplace address on Core Contract...");
  
  // Try sending without estimateGas by hardcoding gasLimit, and bumped gas prices
  const feeData = await signer.provider.getFeeData();
  const tx = await liquidPass.set_marketplace(marketplaceAddress, {
    gasLimit: 2000000,
    maxFeePerGas: feeData.maxFeePerGas * 2n,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n
  });
  await tx.wait();
  
  console.log("Success! Core contract now trusts the Marketplace.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
