pragma solidity ^0.4.17;

contract Remittance{
	mapping(bytes32 => RemitStruct) public remittances;
	uint constant DURATION_LIMIT = 10;

	event LogDeposit(address indexed sender, address indexed receiver, uint amount, uint deadline);
	event LogWithdraw(address indexed withdrawer, uint amount, uint deadline);

	struct RemitStruct{
		address remitOwner;
		address remitReceiver;
		uint remitAmt;
		uint deadline;
		bool hasWithdrawn;
	}

	function Remittance() public{
	}

	/*
		Accept remittance deposit. 
	*/
	function deposit(address receiver, uint duration, bytes32 secret) 
		public 
		payable 
	{
		/* 
			Check that there is no remittance collision.
			If there is collision, that means the sender already has an pending remittance with the same set of password
			with the exchange, waiting to be withdrawn by the receiver.
			In this case, the deposit should be rejected so that the receiver is able to have multiple pending remittance at once.
		*/  
		require(remittances[secret].remitOwner == address(0));

		// Validate basic input
		require(receiver != address(0));
		require(msg.value > 0);
		require(duration <= DURATION_LIMIT);

		// Store remittance
		RemitStruct memory curRemittance;
		curRemittance.remitOwner = msg.sender;
		curRemittance.remitReceiver = receiver;
		curRemittance.remitAmt = msg.value;
		curRemittance.deadline = block.number + duration;
		curRemittance.hasWithdrawn = false;

		remittances[secret] = curRemittance;
		LogDeposit(msg.sender, receiver, msg.value, curRemittance.deadline);
	}

	/*
		Withdraw the balance by providing the secret passwords.
	*/
	function withdraw(address secretKey, bytes32 secret)
		public
	{
		// Retrieve remittance
		bytes32 realSecret = keccak256(secretKey, secret);
		RemitStruct memory _remittance = remittances[realSecret];

		// Validate if realSecret is correct
		require(_remittance.remitOwner != address(0));

		// Validate if remittance has already been withdrawn
		require(_remittance.hasWithdrawn == false);

		// Validate that current block has not exceed deadline.
		// Only remittance owner is able to withdraw the funds back after deadline has exceeded.
		require((block.number <= _remittance.deadline && msg.sender == _remittance.remitReceiver) || msg.sender == _remittance.remitOwner);

		// Soft delete.
		remittances[realSecret].hasWithdrawn = true;
		LogWithdraw(msg.sender, _remittance.remitAmt, _remittance.deadline);

		// Interact with untrusted address last.
		msg.sender.transfer(_remittance.remitAmt);
	}

	/*
	 	Do not accept any funds from other sources.
	*/
	function() public payable{ revert(); }
}