import hre from "hardhat";

/**
 * Deploy StreamRental against the live core.
 *
 *   npx hardhat run scripts/deployStreamRental.js --network arbitrumSepolia
 *
 * Nothing else needs changing on chain. StreamRental drives the core through
 * transferPass(), which any owner may call, so it needs no privileged role and
 * the core is not touched.
 *
 * Afterwards, set NEXT_PUBLIC_STREAM_RENTAL_ADDRESS in web/.env.local and in
 * Vercel. The rental UI stays hidden until it is set.
 */

/** The Rust core the whole system is built on. Deployed; do not change. */
const CORE = "0xac20ef73723e7c620df1024eb04cc0b71fca1055";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Deployer :", deployer.address);
  console.log("Balance  :", hre.ethers.formatEther(balance), "ETH");
  console.log("Core     :", CORE);

  if (balance === 0n) {
    throw new Error("Deployer has no ETH on this network.");
  }

  // Guard against deploying against an address with no code, which would
  // produce a rental contract that reverts on every call.
  const code = await hre.ethers.provider.getCode(CORE);
  if (code === "0x") {
    throw new Error(`No contract deployed at ${CORE} on this network.`);
  }

  console.log("\nDeploying StreamRental...");
  const StreamRental = await hre.ethers.getContractFactory("StreamRental");
  const rental = await StreamRental.deploy(CORE);
  await rental.waitForDeployment();

  const address = await rental.getAddress();
  console.log("StreamRental deployed to:", address);

  console.log("\nNext:");
  console.log("  NEXT_PUBLIC_STREAM_RENTAL_ADDRESS=" + address);
  console.log("\nTo rent a pass out, in this order:");
  console.log("  1. streamRental.openStream(tokenId, ratePerSecond)   <- while you still own it");
  console.log("  2. liquidPass.transferPass(" + address + ", tokenId)");
  console.log("The order matters; openStream requires you to be the current owner.");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
