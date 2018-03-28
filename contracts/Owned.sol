pragma solidity ^0.4.17;

contract Owned {
    address private owner;

    event LogSetOwner(address indexed oldOwner, address indexed newOwner);

    function Owned() public {
        owner = msg.sender;
    }

    modifier onlyOwner () {
        require(msg.sender == owner);
        _;
    }

    function getOwner()
        public
        view
        returns (address)
    {
        return owner;
    }

    function setOwner(address newOwner)
        public
        onlyOwner()
    {
        owner = newOwner;
        LogSetOwner(msg.sender, newOwner);
    }
}