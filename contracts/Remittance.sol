pragma solidity ^0.4.17;

contract Remittance{
	mapping(bytes32 => uint) public remitBalances;
	event LogDeposit(address indexed sender, address indexed receiver, uint amount);
	event LogWithdraw(address indexed withdrawer, uint amount);

	function Remittance() public{
	}

	/*
		Accept remittance deposit. 
	*/
	function deposit(address receiver, string password1, string password2) 
		public 
		payable 
	{
		// Validate basic input
		require(receiver != address(0) && bytes(password1).length >= 4 && bytes(password2).length >= 4);
		require(msg.value > 0);

		// Store remittance amount
		bytes32 secret = keccak256(receiver, password1, password2);
		remitBalances[secret] = msg.value;
		LogDeposit(msg.sender, receiver, msg.value);
	}

	/*
		Withdraw the balance by providing the secret passwords.
	*/
	function withdraw(string password1, string password2)
		public
	{
		// Compute secret
		bytes32 secret = keccak256(msg.sender, password1, password2);
		uint remitAmt = remitBalances[secret];

		// Validate if secret is correct
		require(remitAmt > 0);

		remitBalances[secret] = 0;
		LogWithdraw(msg.sender, remitAmt);

		// Interact with untrusted address last.
		msg.sender.transfer(remitAmt);
	}

	/*
	 	Do not accept any funds from other sources.
	*/
	function() public payable{ revert(); }
}