var Remittance = artifacts.require("./Remittance.sol");
const Promise = require("bluebird");
Promise.promisifyAll(web3.eth, { suffix: "Promise" });

const web3Utils = require("web3-utils");

contract("Remittance", function(accounts){
	// Declare test variables here
	var remittanceContract;
	var owner = accounts[0];
	var alice = accounts[1];
	var carol = accounts[2];

	// The unit of measurement here is ether
	var remitAmt = web3.toWei(0.01, "ether");
	var secret = web3Utils.soliditySha3(carol, "password1", "password2");

	// Set the initial test state before running each test
	beforeEach("deploy new Remittance instance", function(){
		return Remittance.new({from: owner})
		.then(instance => remittanceContract = instance);
	});

	// Write tests here
	describe("deposit", function(){
		it("should allow Alice to deposit remittance.", function(){
			return remittanceContract.deposit(carol, secret, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[0].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong sender amount.");
				return web3.eth.getBalancePromise(remittanceContract.address);
			})
			.then(function(contractBalance){
				assert.strictEqual(contractBalance.toString(10), remitAmt, "Contract balance does not tally with the sender's deposit.");
			});
		});
	});

	describe("withdraw", function(){
		beforeEach("deposit remit amount", function(){
			return remittanceContract.deposit(carol, secret, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[0].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong remittance amount.");
			})
		});

		it("should allow Carol to withdraw remittance.", function(){
			var carolInitialBalance;
			var gasUsed, gasPrice;

			return web3.eth.getBalancePromise(carol)
			.then(function(_carolInitialBalance){
				carolInitialBalance = _carolInitialBalance;
				return remittanceContract.withdraw("password1", "password2", {from: carol})
			})			
			.then(function(txn){
				// Check withdraw event is logged
				assert.strictEqual(txn.logs.length, 1, 				 	"Withdraw event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogWithdraw",	"Event logged is not a Withdraw event.");
				assert.strictEqual(txn.logs[0].args.withdrawer, carol, 	"Wrong withdrawer.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong withdrawal amount.");
				gasUsed = txn.receipt.gasUsed;
				return web3.eth.getTransactionPromise(txn.tx);
			})
			.then(function(txn){
				gasPrice = txn.gasPrice;
				return web3.eth.getBalancePromise(carol);
			})
			.then(function(carolAfterWithdrawBalance){
				var txnFee = gasPrice.times(gasUsed);
				assert.strictEqual(carolAfterWithdrawBalance.minus(carolInitialBalance).plus(txnFee).toString(10), 
									remitAmt, 
									"Something is wrong with Carol's balance after withdrawal.");
			});
		});


	});
});