import { createKernelAccountClient, createKernelAccount } from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { signerToSessionKeyValidator, serializeSessionKeyAccount } from "@zerodev/session-key";
const ENTRYPOINT_ADDRESS_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
import { arbitrumSepolia } from "viem/chains";
import { createPublicClient, http, type WalletClient } from "viem";
import { MARKETPLACE_ADDRESS, marketplaceAbi } from "./contract";
import { encodeFunctionData } from "viem";

const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;
const BUNDLER_URL = `https://rpc.zerodev.app/api/v2/bundler/${ZERODEV_PROJECT_ID}`;
const PAYMASTER_URL = `https://rpc.zerodev.app/api/v2/paymaster/${ZERODEV_PROJECT_ID}`;

export async function createSessionKey(walletClient: WalletClient) {
  if (!ZERODEV_PROJECT_ID) throw new Error("Missing ZeroDev Project ID");

  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(BUNDLER_URL),
  });

  // 1. Create ECDSA Validator for the main signer (the user's MetaMask)
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signer: walletClient as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entryPoint: ENTRYPOINT_ADDRESS_V07 as any,
  });

  // 2. Create the Session Key Validator
  // The session key can ONLY call the `list` function on the Marketplace contract
  // This ensures the backend/oracle cannot steal funds, only list the pass!
  const sessionKeyValidator = await signerToSessionKeyValidator(publicClient, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signer: walletClient as any, // In a real app, this would be a new local burner wallet created just for the session
    validatorData: {
      permissions: [
        {
          target: MARKETPLACE_ADDRESS,
          valueLimit: 0n,
          abi: marketplaceAbi,
          functionName: "list",
        },
      ],
      // validUntil: Date.now() / 1000 + 7 * 24 * 60 * 60, // Valid for 7 days
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entryPoint: ENTRYPOINT_ADDRESS_V07 as any,
  });

  // 3. Create the Kernel Smart Account
  const sessionKeyAccount = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
      regular: sessionKeyValidator,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entryPoint: ENTRYPOINT_ADDRESS_V07 as any,
  });

  // 4. Serialize the session key so it can be sent to our Oracle backend
  const serializedSessionKey = await serializeSessionKeyAccount(sessionKeyAccount);
  
  return serializedSessionKey;
}
