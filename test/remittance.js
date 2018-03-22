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
	const remitAmt = web3.toWei(0.01, "ether");
	const remitDuration = 10; // In blocks

	// Secret will consist of:
	// Sender's Address, Ether Exchange Address, Receipient name, Exchange's OTP, Receipient's OTP
	const secret = web3Utils.soliditySha3(alice, "bob", "password1", "password2");
	const depositSecret = web3Utils.soliditySha3(carol, secret);
	const secret2 = web3Utils.soliditySha3(alice, "anotherPerson", "password1", "password2");
	const depositSecret2 = web3Utils.soliditySha3(carol, secret2);

	// Set the initial test state before running each test
	beforeEach("deploy new Remittance instance", function(){
		return Remittance.new({from: owner})
		.then(instance => remittanceContract = instance);
	});

	// Write tests here
	describe("deposit", function(){
		it("should allow Alice to deposit remittance to the ether exchange.", function(){
			return remittanceContract.deposit(carol, remitDuration, depositSecret, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[0].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong sender amount.");
				assert.strictEqual(txn.logs[0].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[0].args.secret, depositSecret, "Wrong secret hash.");
				return web3.eth.getBalancePromise(remittanceContract.address);
			})
			.then(function(contractBalance){
				assert.strictEqual(contractBalance.toString(10), remitAmt, "Contract balance does not tally with the sender's deposit.");
			});
		});

		it("should not allow Alice to deposit remittance to the ether exchange if the same password is used again on the same receipient.", function(){
			return remittanceContract.deposit(carol, remitDuration, depositSecret, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[0].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong sender amount.");
				assert.strictEqual(txn.logs[0].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[0].args.secret, depositSecret, "Wrong secret hash.");
				return remittanceContract.deposit(carol, remitDuration, depositSecret, {from: alice, value: remitAmt})
			})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", 
					"Alice is able to deposit twice with the same secret hash. Error is not emitted.");
			});
		});

		it("should allow Alice to deposit remittance to the ether exchange if the same password is used on different receipients.", function(){
			return remittanceContract.deposit(carol, remitDuration, depositSecret, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[0].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong sender amount.");
				assert.strictEqual(txn.logs[0].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[0].args.secret, depositSecret, "Wrong secret hash.");
				return remittanceContract.deposit(carol, remitDuration, depositSecret2, {from: alice, value: remitAmt})
			})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[0].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong sender amount.");
				assert.strictEqual(txn.logs[0].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[0].args.secret, depositSecret2, "Wrong secret hash.");
			});
		});

		it("should not allow Alice to deposit remittance if the remittance duration exceeds the limit.", function(){
			return remittanceContract.deposit(carol, remitDuration + 1, depositSecret, {from: alice, value: remitAmt})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", 
					"Alice has deposit with a deadline duration that is off the limits. Error is not emitted.");
			});
		});
	});

	describe("withdraw", function(){
		beforeEach("deposit remit amount", function(){
			return remittanceContract.deposit(carol, remitDuration, depositSecret, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[0].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong remittance amount.");
				assert.strictEqual(txn.logs[0].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[0].args.secret, depositSecret, "Wrong secret hash.");
			})
		});

		it("should allow Carol to withdraw remittance within the deadline.", function(){
			var carolInitialBalance;
			var gasUsed, gasPrice;

			return web3.eth.getBalancePromise(carol)
			.then(function(_carolInitialBalance){
				carolInitialBalance = _carolInitialBalance;
				return remittanceContract.withdraw(secret, {from: carol})
			})
			.then(function(txn){
				// Check withdraw event is logged
				assert.strictEqual(txn.logs.length, 1, 				 	"Withdraw event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogWithdraw",	"Event logged is not a Withdraw event.");
				assert.strictEqual(txn.logs[0].args.withdrawer, carol, 	"Wrong withdrawer.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong withdrawal amount.");
				assert.strictEqual(txn.logs[0].args.secret, depositSecret, "Wrong secret hash.");
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

		it("should not allow Carol to withdraw remittance twice within the deadline.", function(){
			var carolInitialBalance;
			var gasUsed, gasPrice;

			return web3.eth.getBalancePromise(carol)
			.then(function(_carolInitialBalance){
				carolInitialBalance = _carolInitialBalance;
				return remittanceContract.withdraw(secret, {from: carol})
			})
			.then(function(txn){
				// Check withdraw event is logged
				assert.strictEqual(txn.logs.length, 1, 				 	"Withdraw event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogWithdraw",	"Event logged is not a Withdraw event.");
				assert.strictEqual(txn.logs[0].args.withdrawer, carol, 	"Wrong withdrawer.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong withdrawal amount.");
				assert.strictEqual(txn.logs[0].args.secret, depositSecret, "Wrong secret hash.");
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
				return remittanceContract.withdraw(secret, {from: carol});
			})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", 
					"Carol has withdraw remittance twice. Error is not emitted.");
			});
		});

		it("should not allow Carol to withdraw remittance after deadline has exceeded.", function(){
			var currentDuration = 0;

			return Promise.resolve()
			.then(function(){
				// Simulate block increment
				currentDuration++;
				const tryAgain = () => web3.eth.sendTransactionPromise({from: owner, to: alice, value: 0})
				 .then(function(){
				 	if(currentDuration < remitDuration){
				 		currentDuration++;
				 		return Promise.delay(100).then(tryAgain);
				 	}
				 	else{
				 		return remittanceContract.withdraw(secret, {from: carol});
				 	}
				 });

				 return tryAgain();
			})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", 
					"Carol has withdraw remittance even after deadline has exceeded. Error is not emitted.");
			});;
		});
	});

	describe("refund", function(){
		beforeEach("deposit remit amount", function(){
			return remittanceContract.deposit(carol, remitDuration, depositSecret, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[0].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong remittance amount.");
				assert.strictEqual(txn.logs[0].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[0].args.secret, depositSecret, "Wrong secret hash.");
			})
		});

		it("should allow Alice to refund remittance after deadline has exceeded.", function(){
			var aliceInitialBalance;
			var gasUsed, gasPrice;

			var currentDuration = 0;

			return web3.eth.getBalancePromise(alice)
			.then(function(_aliceInitialBalance){
				aliceInitialBalance = _aliceInitialBalance;

				// Simulate block increment
				currentDuration++;
				const tryAgain = () => web3.eth.sendTransactionPromise({from: owner, to: alice, value: 0})
				 .then(function(){
				 	if(currentDuration < remitDuration){
				 		currentDuration++;
				 		return Promise.delay(100).then(tryAgain);
				 	}
				 	else{
				 		return remittanceContract.refund(depositSecret, {from: alice});
				 	}
				 });

				 return tryAgain();
			})
			.then(function(txn){
				// Check refund event is logged
				assert.strictEqual(txn.logs.length, 1, 				 	"Refund event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogRefund",		"Event logged is not a Refund event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 		"Wrong refunder.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong refund amount.");
				assert.strictEqual(txn.logs[0].args.secret, depositSecret, "Wrong secret hash.");
				gasUsed = txn.receipt.gasUsed;
				return web3.eth.getTransactionPromise(txn.tx);
			})
			.then(function(txn){
				gasPrice = txn.gasPrice;
				return web3.eth.getBalancePromise(alice);
			})
			.then(function(aliceAfterWithdrawBalance){
				var txnFee = gasPrice.times(gasUsed);
				assert.strictEqual(aliceAfterWithdrawBalance.minus(aliceInitialBalance).plus(txnFee).toString(10), 
									remitAmt, 
									"Something is wrong with Alice's balance after refund.");
			});
		});

		it("should not allow Alice to refund remittance twice after deadline has exceeded.", function(){
			var aliceInitialBalance;
			var gasUsed, gasPrice;

			var currentDuration = 0;

			return web3.eth.getBalancePromise(alice)
			.then(function(_aliceInitialBalance){
				aliceInitialBalance = _aliceInitialBalance;

				// Simulate block increment
				currentDuration++;
				const tryAgain = () => web3.eth.sendTransactionPromise({from: owner, to: alice, value: 0})
				 .then(function(){
				 	if(currentDuration < remitDuration){
				 		currentDuration++;
				 		return Promise.delay(100).then(tryAgain);
				 	}
				 	else{
				 		return remittanceContract.refund(depositSecret, {from: alice});
				 	}
				 });

				 return tryAgain();
			})
			.then(function(txn){
				// Check refund event is logged
				assert.strictEqual(txn.logs.length, 1, 				 	"Refund event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogRefund",		"Event logged is not a Refund event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 		"Wrong refunder.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), remitAmt, "Wrong refund amount.");
				assert.strictEqual(txn.logs[0].args.secret, depositSecret, "Wrong secret hash.");
				gasUsed = txn.receipt.gasUsed;
				return web3.eth.getTransactionPromise(txn.tx);
			})
			.then(function(txn){
				gasPrice = txn.gasPrice;
				return web3.eth.getBalancePromise(alice);
			})
			.then(function(aliceAfterWithdrawBalance){
				var txnFee = gasPrice.times(gasUsed);
				assert.strictEqual(aliceAfterWithdrawBalance.minus(aliceInitialBalance).plus(txnFee).toString(10), 
									remitAmt, 
									"Something is wrong with Alice's balance after refund.");
				return remittanceContract.refund(depositSecret, {from: alice});
			})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", 
					"Alice is allowed to refund twice. Error is not emitted.");
			});
		});

		it("should not allow Alice to refund remittance if deadline has not exceeded.", function(){
			return remittanceContract.refund(depositSecret, {from: alice})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", 
					"Alice is able to refund even before the deadline exceed. Error is not emitted.");
			});
		});
	});
});