pragma solidity ^0.4.17;
import "./Owned.sol";

contract Stoppable is Owned {
    bool private isActive;

    event LogStop(address indexed sender, bool isActive);
	event LogResume(address indexed sender, bool isActive);

    function Stoppable(bool _isActive) public {
        isActive = _isActive;
    }

    modifier onlyActive () {
        require(isActive == true);
        _;
    }
    
    function getIsActive() 
        public 
        view
        returns (bool)
    {
        return isActive;
    }

    function stop()
    	public
    	onlyOwner()
        onlyActive()
	{
		isActive = false;
		LogStop(msg.sender, isActive);
	}

	function resume()
    	public
    	onlyOwner()
	{
        require(!isActive);
		isActive = true;
		LogResume(msg.sender, isActive);
	}
}