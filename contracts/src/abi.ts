export const abi = [
    "function register(uint256 x, uint256 y) external",
    "function getChallenge(address target, uint256 value, bytes calldata data) external view returns (bytes32)",
    "function execute(address target, uint256 value, bytes calldata data, bytes calldata auth_data, bytes calldata client_data, bytes32 r, bytes32 s) external returns (bytes memory)",
    "function nonce() external view returns (uint256)",
    "function pubkey() external view returns (uint256, uint256)"
] as const;