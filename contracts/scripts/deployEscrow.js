import hre from "hardhat";

/**
 * Deploy EscrowYield and link it to the live Marketplace.
 *
 * TWO THINGS WERE WRONG WITH THIS SCRIPT AND BOTH WOULD HAVE BITTEN ON FIRST
 * RUN:
 *
 * 1. It pointed at marketplace 0x00Ce3047..., which is a superseded
 *    deployment. The core trusts 0x63a9edec..., so linking the escrow to the
 *    old one would have produced an escrow that no live sale ever routes
 *    through.
 *
 * 2. Two of the three Aave addresses below fail their EIP-55 checksum, so
 *    ethers rejects them before anything is deployed. A wrong checksum means
 *    either the capitalisation or a hex digit is wrong, and there is no way to
 *    tell which from here -- so they are NOT silently "corrected". Guessing a
 *    contract address is how funds get sent to nowhere.
 *
 * Before running this, replace the Aave addresses with ones copied from Aave's
 * own address book for Arbitrum Sepolia, and set AAVE_ADDRESSES_VERIFIED=1.
 */

const AAVE = {
  // Aave V3, Arbitrum Sepolia. UNVERIFIED - see the note above.
  pool: "0xB50201558B00496A145fE76f7424749556E326D8",
  wethGateway: "0x153C3502CBE10b97A0A939462A0D8D905139049d",
  aWeth: "0xe80772Eaf6e2E18B651F160Bc9158b2A5caFCA65",
};

/** The marketplace the core actually trusts. */
const MARKETPLACE = "0x63a9edec92baf3e74f19d301808c56104e786241";

function assertChecksummed(label, address) {
  const canonical = hre.ethers.getAddress(address.toLowerCase());
  if (canonical !== address) {
    throw new Error(
      `${label} (${address}) is not correctly checksummed.\n` +
        `  Canonical form of those digits: ${canonical}\n` +
        `  That means the capitalisation or a hex digit is wrong. Copy the\n` +
        `  address from Aave's address book rather than trusting this file.`,
    );
  }
}

async function main() {
  if (process.env.AAVE_ADDRESSES_VERIFIED !== "1") {
    throw new Error(
      "Refusing to deploy.\n\n" +
        "The Aave addresses in this script have never been verified, and two of\n" +
        "the three fail their EIP-55 checksum. Confirm them against Aave's own\n" +
        "documentation for Arbitrum Sepolia, update this file, then re-run with\n" +
        "AAVE_ADDRESSES_VERIFIED=1.",
    );
  }

  assertChecksummed("Aave Pool", AAVE.pool);
  assertChecksummed("Aave WETH Gateway", AAVE.wethGateway);
  assertChecksummed("aWETH", AAVE.aWeth);

  console.log("Deploying EscrowYield...");
  const EscrowYield = await hre.ethers.getContractFactory("EscrowYield");
  const escrow = await EscrowYield.deploy(AAVE.wethGateway, AAVE.pool, AAVE.aWeth);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("EscrowYield deployed to:", escrowAddress);

  console.log("Linking EscrowYield -> Marketplace...");
  let tx = await escrow.setMarketplace(MARKETPLACE);
  await tx.wait();

  console.log("Linking Marketplace -> EscrowYield...");
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = Marketplace.attach(MARKETPLACE);
  tx = await marketplace.setEscrow(escrowAddress);
  await tx.wait();

  console.log("\nDone.");
  console.log("Set NEXT_PUBLIC_ESCROW_ADDRESS to", escrowAddress);
  console.log("The dashboard's yield panel stays hidden until that is set.");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
