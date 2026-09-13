import hre from "hardhat";

/**
 * Deploy IssuerRequests against the live core.
 *
 *   npx hardhat run scripts/deployIssuerRequests.js --network arbitrumSepolia
 *
 * Needs no role on the core: it only reads admin() and isIssuer(). Approving a
 * request is still the admin calling the core's own setIssuer().
 *
 * Afterwards, set NEXT_PUBLIC_ISSUER_REQUESTS_ADDRESS (the web app also carries
 * the deployed address as its fallback).
 */

/** The Rust core. Deployed; do not change. */
const CORE = "0xac20ef73723e7c620df1024eb04cc0b71fca1055";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer :", deployer.address);
  console.log("Balance  :", hre.ethers.formatEther(balance), "ETH");
  if (balance === 0n) throw new Error("Deployer has no ETH on this network.");

  const code = await hre.ethers.provider.getCode(CORE);
  if (code === "0x") throw new Error(`No contract deployed at ${CORE} on this network.`);

  console.log("\nDeploying IssuerRequests...");
  const Factory = await hre.ethers.getContractFactory("IssuerRequests");
  const inbox = await Factory.deploy(CORE);
  await inbox.waitForDeployment();
  const address = await inbox.getAddress();
  console.log("IssuerRequests deployed to:", address);
  console.log("Deploy tx:", inbox.deploymentTransaction()?.hash);

  // Prove it is wired to the core before anyone relies on it.
  console.log("liquidPass() =", await inbox.liquidPass());
  console.log("requesterCount() =", (await inbox.requesterCount()).toString());
  console.log("\nNEXT_PUBLIC_ISSUER_REQUESTS_ADDRESS=" + address);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
