import "@nomicfoundation/hardhat-toolbox";
import fs from "fs";

const privateKey = fs.readFileSync("./deployer.key", "utf8").trim();

const config = {
  solidity: "0.8.20",
  paths: {
    sources: "./src",
  },
  networks: {
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: [privateKey],
    },
  },
};

export default config;
