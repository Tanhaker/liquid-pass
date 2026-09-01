// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IWETHGateway {
    function depositETH(address pool, address onBehalfOf, uint16 referralCode) external payable;
    function withdrawETH(address pool, uint256 amount, address to) external;
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

contract EscrowYield {
    address public marketplace;
    IWETHGateway public wethGateway;
    IPool public aavePool;
    address public aWETH; 

    // Tracks the base principal deposited for each seller
    mapping(address => uint256) public lockedBalances;

    event YieldDeposited(address indexed seller, uint256 amount);
    event YieldWithdrawn(address indexed seller, uint256 principal, uint256 totalPayout);

    constructor(address _wethGateway, address _aavePool, address _aWETH) {
        wethGateway = IWETHGateway(_wethGateway);
        aavePool = IPool(_aavePool);
        aWETH = _aWETH;
        
        // Infinite approve the WETH gateway so it can burn our aWETH when we withdraw ETH
        IERC20(aWETH).approve(address(wethGateway), type(uint256).max);
    }

    function setMarketplace(address _marketplace) external {
        require(marketplace == address(0), "Already set");
        marketplace = _marketplace;
    }

    // Called automatically by the Marketplace when a pass is sold
    function depositYield(address seller) external payable {
        require(msg.sender == marketplace, "Only marketplace can deposit");
        require(msg.value > 0, "Zero deposit");

        lockedBalances[seller] += msg.value;

        // Wrap ETH and deposit into Aave V3 to start earning interest immediately!
        wethGateway.depositETH{value: msg.value}(address(aavePool), address(this), 0);

        emit YieldDeposited(seller, msg.value);
    }

    // Seller withdraws their funds (Principal + Aave Interest)
    function withdraw() external {
        uint256 principal = lockedBalances[msg.sender];
        require(principal > 0, "No funds locked");

        lockedBalances[msg.sender] = 0; // Prevent re-entrancy

        // For a full production DeFi vault, we would calculate exact share values. 
        // For the hackathon, we withdraw the principal. Any excess aWETH left in the contract 
        // represents the total protocol yield generated over time!
        wethGateway.withdrawETH(address(aavePool), principal, msg.sender);

        emit YieldWithdrawn(msg.sender, principal, principal);
    }
    
    // Allow contract to receive ETH back from WETH Gateway during withdrawal
    receive() external payable {}
}
