var Remittance = artifacts.require("./Remittance.sol");
const Promise = require("bluebird");
Promise.promisifyAll(web3.eth, { suffix: "Promise" });

contract("Remittance", function(accounts){
	// Declare test variables here
	var remittanceContract;
	var owner = accounts[0];
	var alice = accounts[1];
	var carol = accounts[2];

	const remitDuration = 10; 		// In blocks
	const remitCommissionRate = 10; // In percentage

	// The unit of measurement here is ether
	const remitAmt = web3.toWei(0.01, "ether");
	const remitCommission = remitAmt * (remitCommissionRate/100);
	const remitAmtAfterCommission = remitAmt - remitCommission;

	// Secret will consist of:
	// Exchange's OTP, Receipient's OTP
	var secret, depositKey;

	// Set the initial test state before running each test
	beforeEach("deploy new Remittance instance and generate key", function(){
		return Remittance.new(carol, remitDuration, remitCommissionRate, true, {from: owner})
		.then(function(instance){
			remittanceContract = instance
			return remittanceContract.generateSecret("password1", "password2");
		})
		.then(function(_secret){
			secret = _secret;
			return remittanceContract.generateKey(carol, secret);
		})
		.then(function(_key){
			depositKey = _key;
		});
	});

	// Write tests here
	describe("deposit", function(){
		it("should allow Alice to deposit remittance to the ether exchange.", function(){
			return remittanceContract.deposit(carol, remitDuration, depositKey, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 2, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[1].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[1].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[1].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[1].args.amount.toNumber(10), remitAmtAfterCommission, "Wrong sender amount.");
				assert.strictEqual(txn.logs[1].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[1].args.key, depositKey, "Wrong key.");
				return web3.eth.getBalancePromise(remittanceContract.address);
			})
			.then(function(contractBalance){
				assert.strictEqual(contractBalance.toString(10), remitAmt, "Contract balance does not tally with the sender's deposit.");
			});
		});

		it("should not allow Alice to deposit remittance to the ether exchange if the same password is used.", function(){
			return remittanceContract.deposit(carol, remitDuration, depositKey, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 2, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[1].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[1].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[1].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[1].args.amount.toNumber(10), remitAmtAfterCommission, "Wrong sender amount.");
				assert.strictEqual(txn.logs[1].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[1].args.key, depositKey, "Wrong key.");
				return remittanceContract.deposit(carol, remitDuration, depositKey, {from: alice, value: remitAmt})
			})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", 
					"Alice is able to deposit twice with the same key. Error is not emitted.");
			});
		});

		it("should not allow Alice to deposit remittance if the remittance duration exceeds the limit.", function(){
			return remittanceContract.deposit(carol, remitDuration + 1, depositKey, {from: alice, value: remitAmt})
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
			return remittanceContract.deposit(carol, remitDuration, depositKey, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 2, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[1].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[1].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[1].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[1].args.amount.toNumber(10), remitAmtAfterCommission, "Wrong remittance amount.");
				assert.strictEqual(txn.logs[1].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[1].args.key, depositKey, "Wrong key.");
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
				assert.strictEqual(txn.logs[0].args.amount.toNumber(10), remitAmtAfterCommission, "Wrong withdrawal amount.");
				assert.strictEqual(txn.logs[0].args.key, depositKey, "Wrong key.");
				gasUsed = txn.receipt.gasUsed;
				return web3.eth.getTransactionPromise(txn.tx);
			})
			.then(function(txn){
				gasPrice = txn.gasPrice;
				return web3.eth.getBalancePromise(carol);
			})
			.then(function(carolAfterWithdrawBalance){
				var txnFee = gasPrice.times(gasUsed);
				assert.strictEqual(carolAfterWithdrawBalance.minus(carolInitialBalance).plus(txnFee).toNumber(10), 
									remitAmtAfterCommission, 
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
				assert.strictEqual(txn.logs[0].args.amount.toNumber(10), remitAmtAfterCommission, "Wrong withdrawal amount.");
				assert.strictEqual(txn.logs[0].args.key, depositKey, "Wrong key.");
				gasUsed = txn.receipt.gasUsed;
				return web3.eth.getTransactionPromise(txn.tx);
			})
			.then(function(txn){
				gasPrice = txn.gasPrice;
				return web3.eth.getBalancePromise(carol);
			})
			.then(function(carolAfterWithdrawBalance){
				var txnFee = gasPrice.times(gasUsed);
				assert.strictEqual(carolAfterWithdrawBalance.minus(carolInitialBalance).plus(txnFee).toNumber(10), 
									remitAmtAfterCommission, 
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
			return remittanceContract.deposit(carol, remitDuration, depositKey, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 2, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[1].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[1].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[1].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[1].args.amount.toNumber(10), remitAmtAfterCommission, "Wrong remittance amount.");
				assert.strictEqual(txn.logs[1].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[1].args.key, depositKey, "Wrong key.");
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
				 		return remittanceContract.refund(depositKey, {from: alice});
				 	}
				 });

				 return tryAgain();
			})
			.then(function(txn){
				// Check refund event is logged
				assert.strictEqual(txn.logs.length, 1, 				 	"Refund event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogRefund",		"Event logged is not a Refund event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 		"Wrong refunder.");
				assert.strictEqual(txn.logs[0].args.amount.toNumber(10), remitAmtAfterCommission, "Wrong refund amount.");
				assert.strictEqual(txn.logs[0].args.key, depositKey, "Wrong key.");
				gasUsed = txn.receipt.gasUsed;
				return web3.eth.getTransactionPromise(txn.tx);
			})
			.then(function(txn){
				gasPrice = txn.gasPrice;
				return web3.eth.getBalancePromise(alice);
			})
			.then(function(aliceAfterWithdrawBalance){
				var txnFee = gasPrice.times(gasUsed);
				assert.strictEqual(aliceAfterWithdrawBalance.minus(aliceInitialBalance).plus(txnFee).toNumber(10), 
									remitAmtAfterCommission, 
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
				 		return remittanceContract.refund(depositKey, {from: alice});
				 	}
				 });

				 return tryAgain();
			})
			.then(function(txn){
				// Check refund event is logged
				assert.strictEqual(txn.logs.length, 1, 				 	"Refund event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogRefund",		"Event logged is not a Refund event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 		"Wrong refunder.");
				assert.strictEqual(txn.logs[0].args.amount.toNumber(10), remitAmtAfterCommission, "Wrong refund amount.");
				assert.strictEqual(txn.logs[0].args.key, depositKey, "Wrong key.");
				gasUsed = txn.receipt.gasUsed;
				return web3.eth.getTransactionPromise(txn.tx);
			})
			.then(function(txn){
				gasPrice = txn.gasPrice;
				return web3.eth.getBalancePromise(alice);
			})
			.then(function(aliceAfterWithdrawBalance){
				var txnFee = gasPrice.times(gasUsed);
				assert.strictEqual(aliceAfterWithdrawBalance.minus(aliceInitialBalance).plus(txnFee).toNumber(10), 
									remitAmtAfterCommission, 
									"Something is wrong with Alice's balance after refund.");
				return remittanceContract.refund(depositKey, {from: alice});
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
			return remittanceContract.refund(depositKey, {from: alice})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", 
					"Alice is able to refund even before the deadline exceed. Error is not emitted.");
			});
		});
	});

	describe("commission", function(){
		beforeEach("deposit remit amount", function(){
			return remittanceContract.deposit(carol, remitDuration, depositKey, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check commission deposit event is logged
				assert.strictEqual(txn.logs.length, 2, 				"Commission deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogCommissionDeposit", "Event logged is not a Commission deposit event.");
				assert.strictEqual(txn.logs[0].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[0].args.owner, owner,"Wrong receiver.");
				assert.strictEqual(txn.logs[0].args.ownerCommission.toNumber(10), remitCommission, "Wrong commission amount.");
				assert.strictEqual(txn.logs[0].args.key, depositKey, "Wrong key.");

				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 2, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[1].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[1].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[1].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[1].args.amount.toNumber(10), remitAmtAfterCommission, "Wrong remittance amount.");
				assert.strictEqual(txn.logs[1].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[1].args.key, depositKey, "Wrong key.");
			})
		});

		it("should give owner commission when there is a remittance deposit.", function(){
			return remittanceContract.getOwnerCommission()
			.then(function(_ownerCommission){
				assert.strictEqual(_ownerCommission.toNumber(10), remitCommission, "Incorrect owner commission given.");
			});
		});

		it("should allow owner to withdraw commission.", function(){
			return remittanceContract.withdrawCommission()
			.then(function(txn){
				// Check commission withdraw event is logged
				assert.strictEqual(txn.logs.length, 1, 				"Commission withdraw event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogCommissionWithdraw", "Event logged is not a Commission withdraw event.");
				assert.strictEqual(txn.logs[0].args.owner, owner, 	"Wrong owner.");
				assert.strictEqual(txn.logs[0].args.ownerCommission.toNumber(10), remitCommission, "Wrong commission amount.");
			});
		});
	});

	describe("kill switch/stoppable", function(){
		it("should allow owner to stop the contract.", function(){
			return remittanceContract.stop({from: owner})
			.then(function(txn){
				// Check stop event is logged
				assert.strictEqual(txn.logs.length, 1, "Stop event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogStop", "Event logged is not a Stop event.");
				assert.strictEqual(txn.logs[0].args.sender, owner, "Wrong owner.");
				assert.strictEqual(txn.logs[0].args.isActive, false, "Wrong active status.");
			});
		});

		it("should not allow owner to stop the contract twice.", function(){
			return remittanceContract.stop({from: owner})
			.then(function(txn){
				// Check stop event is logged
				assert.strictEqual(txn.logs.length, 1, "Stop event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogStop", "Event logged is not a Stop event.");
				assert.strictEqual(txn.logs[0].args.sender, owner, "Wrong owner.");
				assert.strictEqual(txn.logs[0].args.isActive, false, "Wrong active status.");
				return remittanceContract.stop({from: owner});
			})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", "Error is not emitted.");
			});
		});

		it("should allow owner to resume the contract.", function(){
			return remittanceContract.stop({from: owner})
			.then(function(txn){
				// Check stop event is logged
				assert.strictEqual(txn.logs.length, 1, "Stop event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogStop", "Event logged is not a Stop event.");
				assert.strictEqual(txn.logs[0].args.sender, owner, "Wrong owner.");
				assert.strictEqual(txn.logs[0].args.isActive, false, "Wrong active status.");
				return remittanceContract.resume({from: owner});
			})
			.then(function(txn){
				// Check resume event is logged
				assert.strictEqual(txn.logs.length, 1, "Resume event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogResume", "Event logged is not a Resume event.");
				assert.strictEqual(txn.logs[0].args.sender, owner, "Wrong owner.");
				assert.strictEqual(txn.logs[0].args.isActive, true, "Wrong active status.");
			});
		});

		it("should not allow owner to resume the contract twice.", function(){
			return remittanceContract.stop({from: owner})
			.then(function(txn){
				// Check stop event is logged
				assert.strictEqual(txn.logs.length, 1, "Stop event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogStop", "Event logged is not a Stop event.");
				assert.strictEqual(txn.logs[0].args.sender, owner, "Wrong owner.");
				assert.strictEqual(txn.logs[0].args.isActive, false, "Wrong active status.");
				return remittanceContract.resume({from: owner});
			})
			.then(function(txn){
				// Check resume event is logged
				assert.strictEqual(txn.logs.length, 1, "Resume event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogResume", "Event logged is not a Resume event.");
				assert.strictEqual(txn.logs[0].args.sender, owner, "Wrong owner.");
				assert.strictEqual(txn.logs[0].args.isActive, true, "Wrong active status.");
				return remittanceContract.resume({from: owner});
			})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", "Error is not emitted.");
			});
		});

		it("should not allow others to stop the contract.", function(){
			return remittanceContract.stop({from: alice})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", "Error is not emitted.");
			});
		});

		it("should not allow others to resume the contract.", function(){
			return remittanceContract.stop({from: owner})
			.then(function(txn){
				// Check stop event is logged
				assert.strictEqual(txn.logs.length, 1, "Stop event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogStop", "Event logged is not a Stop event.");
				assert.strictEqual(txn.logs[0].args.sender, owner, "Wrong owner.");
				assert.strictEqual(txn.logs[0].args.isActive, false, "Wrong active status.");
				return remittanceContract.resume({from: alice});
			})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", "Error is not emitted.");
			});
		});

		it("should not allow remittance sender to deposit when the contract is stopped.", function(){
			return remittanceContract.stop({from: owner})
			.then(function(txn){
				// Check stop event is logged
				assert.strictEqual(txn.logs.length, 1, "Stop event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogStop", "Event logged is not a Stop event.");
				assert.strictEqual(txn.logs[0].args.sender, owner, "Wrong owner.");
				assert.strictEqual(txn.logs[0].args.isActive, false, "Wrong active status.");
				return remittanceContract.deposit(carol, remitDuration, depositKey, {from: alice, value: remitAmt});
			})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", "Error is not emitted.");
			});
		});

		it("should not allow remittance exchange to withdraw when the contract is stopped.", function(){
			return remittanceContract.deposit(carol, remitDuration, depositKey, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 2, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[1].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[1].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[1].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[1].args.amount.toNumber(10), remitAmtAfterCommission, "Wrong remittance amount.");
				assert.strictEqual(txn.logs[1].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[1].args.key, depositKey, "Wrong key.");
				return remittanceContract.stop({from: owner});
			})
			.then(function(txn){
				// Check stop event is logged
				assert.strictEqual(txn.logs.length, 1, "Stop event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogStop", "Event logged is not a Stop event.");
				assert.strictEqual(txn.logs[0].args.sender, owner, "Wrong owner.");
				assert.strictEqual(txn.logs[0].args.isActive, false, "Wrong active status.");
				return remittanceContract.withdraw(secret, {from: carol});
			})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", "Error is not emitted.");
			});
		});

		it("should not allow remittance sender to refund when the contract is stopped.", function(){
			var currentDuration = 0;

			return remittanceContract.deposit(carol, remitDuration, depositKey, {from: alice, value: remitAmt})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 2, 				"Deposit event is not emitted.");
				assert.strictEqual(txn.logs[1].event, "LogDeposit", "Event logged is not a Deposit event.");
				assert.strictEqual(txn.logs[1].args.sender, alice, 	"Wrong sender.");
				assert.strictEqual(txn.logs[1].args.receiver, carol,"Wrong receiver.");
				assert.strictEqual(txn.logs[1].args.amount.toNumber(10), remitAmtAfterCommission, "Wrong remittance amount.");
				assert.strictEqual(txn.logs[1].args.deadline.toNumber(10), web3.eth.blockNumber + remitDuration, "Wrong deadline.");
				assert.strictEqual(txn.logs[1].args.key, depositKey, "Wrong key.");
				return remittanceContract.stop({from: owner});
			})
			.then(function(txn){
				// Check stop event is logged
				assert.strictEqual(txn.logs.length, 1, "Stop event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogStop", "Event logged is not a Stop event.");
				assert.strictEqual(txn.logs[0].args.sender, owner, "Wrong owner.");
				assert.strictEqual(txn.logs[0].args.isActive, false, "Wrong active status.");
				
				// Simulate block increment
				currentDuration++;
				const tryAgain = () => web3.eth.sendTransactionPromise({from: owner, to: alice, value: 0})
				 .then(function(){
				 	if(currentDuration < remitDuration){
				 		currentDuration++;
				 		return Promise.delay(100).then(tryAgain);
				 	}
				 	else{
				 		return remittanceContract.refund(depositKey, {from: alice});
				 	}
				 });

				 return tryAgain();				
			})
			.then(function(){
				assert.fail();
			})
			.catch(function(err){
				assert.include(err.message, "VM Exception while processing transaction: revert", "Error is not emitted.");
			});
		});
	});
});