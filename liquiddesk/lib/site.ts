/** Where Liquid Pass itself lives: the marketplace this app's passes come from. */
export const LIQUID_PASS_URL = (process.env.NEXT_PUBLIC_LIQUID_PASS_URL || "https://liquidpass.xyz").replace(/\/$/, "");
