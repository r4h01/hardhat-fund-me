// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
/**
 *@author r4h01
 *@title Fund Me contract
 *@dev this contract use price feeds from chainlink
 */
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./PriceConverter.sol";

error FundMe__NotOwner();
error FundMe__NotEnoughEth();

contract FundMe {
    ///Type declarations
    using PriceConverter for uint256;
    ///State variables
    //s_ indica funzioni salvate in storage

    uint256 public constant MINIMUM_USD = 50 * 10**18;
    address private immutable i_owner;
    address[] public s_funders;
    mapping(address => uint256) private s_addressToAmountFunded;
    AggregatorV3Interface private s_priceFeed;
    ///Events
    event EthInUsd(uint256 quantity);

    ///Modifiers
    modifier onlyOwner() {
        if (msg.sender != i_owner) revert FundMe__NotOwner();
        _;
    }

    ///Functions
    /**
    constructor

    receive function (if exists)

    fallback function (if exists)

    external

    public

    internal

    private 
*/

    ///constructor
    constructor(address priceFeed) {
        s_priceFeed = AggregatorV3Interface(priceFeed);
        i_owner = msg.sender;
    }

    ///public
    function getEthUsdValue() public returns (uint256) {
        uint256 quantity = PriceConverter.getFifthyUsdInEth(s_priceFeed);
        emit EthInUsd(quantity);
        return quantity;
    }

    function fund() public payable {
        if (msg.value.getConversionRate(s_priceFeed) <= MINIMUM_USD)
            revert FundMe__NotEnoughEth();
        s_addressToAmountFunded[msg.sender] += msg.value;
        s_funders.push(msg.sender);
    }

    function withdraw() public payable onlyOwner {
        for (
            uint256 funderIndex = 0;
            funderIndex < s_funders.length;
            funderIndex++
        ) {
            address funder = s_funders[funderIndex];
            s_addressToAmountFunded[funder] = 0;
        }
        s_funders = new address[](0);
        (bool success, ) = i_owner.call{value: address(this).balance}("");
        require(success);
    }

    function cheaperWithdraw() public payable onlyOwner {
        address[] memory funders = s_funders;
        for (
            uint256 funderIndex = 0;
            funderIndex < funders.length;
            funderIndex++
        ) {
            address funder = funders[funderIndex];
            s_addressToAmountFunded[funder] = 0;
        }
        s_funders = new address[](0);
        (bool success, ) = i_owner.call{value: address(this).balance}("");
        require(success);
    }

    function getAddressToAmountFunded(address fundingAddress)
        public
        view
        returns (uint256)
    {
        return s_addressToAmountFunded[fundingAddress];
    }

    function getFunder(uint256 index) public view returns (address) {
        return s_funders[index];
    }

    function getOwner() public view returns (address) {
        return i_owner;
    }

    function getPriceFeed() public view returns (AggregatorV3Interface) {
        return s_priceFeed;
    }
}
