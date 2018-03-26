pragma solidity ^0.4.17;

contract Remittance{
	mapping(bytes32 => RemitStruct) public remittances;
	uint constant DURATION_LIMIT = 10;
	address remittanceExchange;

	event LogDeposit(address indexed sender, address indexed receiver, uint amount, uint deadline, bytes32 key);
	event LogWithdraw(address indexed withdrawer, uint amount, uint deadline, bytes32 key);
	event LogRefund(address indexed sender, uint amount, uint deadline, bytes32 key);

	struct RemitStruct{
		address remitSender;
		uint remitBalance;
		uint deadline;
	}

	function Remittance(address _remittanceExchange) public{
		remittanceExchange = _remittanceExchange;
	}

	/*
		Accept remittance deposit. 
	*/
	function deposit(address receiver, uint duration, bytes32 key) 
		public 
		payable 
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
		require(duration <= DURATION_LIMIT);

		// Store remittance
		RemitStruct memory curRemittance;
		curRemittance.remitSender = msg.sender;
		curRemittance.remitBalance = msg.value;
		curRemittance.deadline = block.number + duration;

		remittances[key] = curRemittance;
		LogDeposit(msg.sender, receiver, msg.value, curRemittance.deadline, key);
	}

	/*
		Withdraw the balance by providing the secret passwords.
	*/
	function withdraw(bytes32 secret)
		public
	{
		// Retrieve remittance
		bytes32 key = keccak256(msg.sender, secret);
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
	 	Do not accept any funds from other sources.
	*/
	function() public payable{ revert(); }
}