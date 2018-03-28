pragma solidity ^0.4.17;
import "./Stoppable.sol";

contract Remittance is Stoppable {
	mapping(bytes32 => RemitStruct) public remittances;	// The list of remittances received.
	uint private durationLimit;							// The maximum duration limit before reaching deadline. In blocks.
	uint private commissionRate;						// The commission rate that the contract owner will get for each deposit. In percentage.
	uint private ownerCommission;						// The total commission of the owner.
	address private remittanceExchange;					// The address of the designated remittance exchange.

	event LogDeposit(address indexed sender, address indexed receiver, uint amount, uint deadline, bytes32 key);
	event LogWithdraw(address indexed withdrawer, uint amount, uint deadline, bytes32 key);
	event LogRefund(address indexed sender, uint amount, uint deadline, bytes32 key);

	event LogSetRemittanceExchange(address indexed owner, address indexed oldRemittanceExchange, address indexed newRemittanceExchange);
	event LogSetDurationLimit(address indexed owner, uint newDurationLimit);
	event LogSetCommissionRate(address indexed owner, uint newCommissionRate);
	event LogCommissionDeposit(address indexed sender, address indexed owner, uint ownerCommission, bytes32 key);
	event LogCommissionWithdraw(address indexed owner, uint ownerCommission);

	struct RemitStruct{
		address remitSender;
		uint remitBalance;
		uint deadline;
	}

	function Remittance(address _remittanceExchange, uint _durationLimit, uint _commissionRate, bool isActive) 
		Stoppable(isActive) 
		public
	{
		require(_remittanceExchange != address(0));
		require(_commissionRate > 0);
		require(_durationLimit > 0);

		remittanceExchange = _remittanceExchange;
		durationLimit = _durationLimit;
		commissionRate = _commissionRate;
		ownerCommission = 0;

		LogSetRemittanceExchange(msg.sender, address(0), remittanceExchange);
		LogSetDurationLimit(msg.sender, durationLimit);
		LogSetCommissionRate(msg.sender, commissionRate);
		LogCommissionDeposit(msg.sender, msg.sender, ownerCommission, 0);
	}

	/*
		Accept remittance deposit. 
	*/
	function deposit(address receiver, uint duration, bytes32 key) 
		public 
		payable 
		onlyActive()
	{
		/* 
			Check that there is no remittance collision.
			If there is collision, that means the sender already has an pending remittance with the same set of password
			with the exchange, waiting to be withdrawn by the receiver.
			In this case, the deposit should be rejected so that the receiver is able to have multiple pending remittance at once.
		*/  
		require(remittances[key].remitSender == address(0));

		// Validate basic input
		require(receiver != address(0));
		require(msg.value > 0);
		require(duration <= durationLimit);

		// Compute commission
		uint currentCommission = (msg.value / 100) * commissionRate;
		ownerCommission += currentCommission;
		LogCommissionDeposit(msg.sender, super.getOwner(), ownerCommission, key);

		// Store remittance
		RemitStruct memory curRemittance;
		curRemittance.remitSender = msg.sender;
		curRemittance.remitBalance = msg.value - currentCommission;
		curRemittance.deadline = block.number + duration;

		remittances[key] = curRemittance;
		LogDeposit(msg.sender, receiver, curRemittance.remitBalance, curRemittance.deadline, key);
	}

	/*
		Withdraw the balance by providing the secret passwords.
	*/
	function withdraw(bytes32 secret)
		public
		onlyActive()
	{
		// Retrieve remittance
		bytes32 key = generateKey(msg.sender, secret);
		RemitStruct memory _remittance = remittances[key];

		// Validate if key is correct
		require(_remittance.remitSender != address(0));

		// Validate if remittance has already been withdrawn
		require(_remittance.remitBalance > 0);

		// Validate that current block has not exceed deadline.
		require(block.number <= _remittance.deadline);

		// Soft delete.
		remittances[key].remitBalance = 0;
		LogWithdraw(remittanceExchange, _remittance.remitBalance, _remittance.deadline, key);

		// Interact with untrusted address last.
		remittanceExchange.transfer(_remittance.remitBalance);
	}

	/*
		Allow refund for remittance sender if the deadline has passed.
	*/
	function refund(bytes32 key)
		public
		onlyActive()
	{
		// Retrieve remittance
		RemitStruct memory _remittance = remittances[key];

		// Validate if key is correct
		require(_remittance.remitSender != address(0));

		// Validate if remittance has already been withdrawn
		require(_remittance.remitBalance > 0);

		// Validate that the deadline has passed and only remittance sender can request for refund
		require(block.number > _remittance.deadline && msg.sender == _remittance.remitSender);

		// Soft delete.
		remittances[key].remitBalance = 0;
		LogRefund(msg.sender, _remittance.remitBalance, _remittance.deadline, key);

		// Interact with untrusted address last.
		msg.sender.transfer(_remittance.remitBalance);
	}

	/*
		Utility for generating the key
	*/
	function generateKey(address sender, bytes32 secret)
		public
		pure
		returns (bytes32)
	{
		return keccak256(sender, secret);
	}

	/*
		Utility for generating the secret
	*/
	function generateSecret(bytes32 password1, bytes32 password2)
		public
		pure
		returns (bytes32)
	{
		return keccak256(password1, password2);
	}

	function withdrawCommission()
		public
		onlyActive()
		onlyOwner()
	{
		require(ownerCommission > 0);
		uint currentCommission = ownerCommission;
		ownerCommission = 0;
		LogCommissionWithdraw(msg.sender, currentCommission);

		// Interact with untrusted address last.
		msg.sender.transfer(currentCommission);
	}

	// Getter / Setter
	function getDurationLimit()
		public
		view
		returns(uint)
	{
		return durationLimit;
	}

	function getCommissionRate()
		public
		view
		returns(uint)
	{
		return commissionRate;
	}

	function getRemittanceExchange()
		public
		view
		returns(address)
	{
		return remittanceExchange;
	}

	function getOwnerCommission()
		public
		view
		returns(uint)
	{
		return ownerCommission;
	}

	function setDurationLimit(uint newDurationLimit)
		public
		onlyOwner()
	{
		require(newDurationLimit > 0 && durationLimit != newDurationLimit);
		durationLimit = newDurationLimit;
		LogSetDurationLimit(msg.sender, durationLimit);
	}

	function setCommissionRate(uint newCommissionRate)
		public
		onlyOwner()
	{
		require(newCommissionRate > 0 && commissionRate != newCommissionRate);
		commissionRate = newCommissionRate;
		LogSetCommissionRate(msg.sender, commissionRate);
	}

	function setRemittanceExchange(address newRemittanceExchange)
		public
		onlyOwner()
	{
		require(remittanceExchange != newRemittanceExchange && newRemittanceExchange != address(0));
		// Note that once the remittance exchange has change, all remittances ether (even the older ones that has not been withdraw) 
		// Upon withdrawal, will be sent to this new exchange.
		address oldRemittanceExchange = remittanceExchange;
		remittanceExchange = newRemittanceExchange;
		LogSetRemittanceExchange(msg.sender, oldRemittanceExchange, remittanceExchange);
	}

	/*
	 	Do not accept any funds from other sources.
	*/
	function() public payable{ revert(); }
}