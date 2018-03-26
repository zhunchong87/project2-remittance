const Web3 = require("web3");
const Promise = require("bluebird");
const truffleContract = require("truffle-contract");
const web3Utils = require("web3-utils");
const $ = require("jquery");
// Not to forget our built contract
const remittanceJson = require("../../build/contracts/Remittance.json");

require("file-loader?name=../index.html!../index.html");

// Supports Mist, and other wallets that provide 'web3'.
if (typeof web3 !== 'undefined') {
    // Use the Mist/wallet/Metamask provider.
    window.web3 = new Web3(web3.currentProvider);
} else {
    // Your preferred fallback.
    window.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:9545'));
}
Promise.promisifyAll(web3.eth, { suffix: "Promise" });
Promise.promisifyAll(web3.version, { suffix: "Promise" });

const Remittance = truffleContract(remittanceJson);
Remittance.setProvider(web3.currentProvider);

var remittanceContract;
var depositEventsArr = [],
    withdrawEventsArr = [],
    refundEventsArr = [];

// Sometimes you have to force the gas amount to a value you know is enough because
// `web3.eth.estimateGas` may get it wrong.
const gas = 300000;

/*******************************
    Contract Related Functions
********************************/
// Deposit Remittance Function
const depositRemittance = function() {
    let exchangeAddress, recipientPwd, exchangePwd, remitAmt, duration, key, secret;

    // We return the whole promise chain so that other parts of the UI can be informed when
    // it is done.
    exchangeAddress = $("#exchangeAddress").val();
    recipientPwd = $("#recipientPwd").val();
    exchangePwd = $("#exchangePwd").val();
    remitAmt = $("#remitAmount").val();
    duration = $("#remitDuration").val();

    console.log("exchangeAddress: ", exchangeAddress);
    console.log("recipientPwd: ", recipientPwd);
    console.log("exchangePwd: ", exchangePwd);
    console.log("remitAmt: ", remitAmt);
    console.log("duration: ", duration);

    secret = web3Utils.soliditySha3(recipientPwd, exchangePwd);
    key = web3Utils.soliditySha3(exchangeAddress, secret);
    console.log("key: ", key);

    return remittanceContract.deposit.call(exchangeAddress, duration, key, { from: window.account, value: web3.toWei(remitAmt, "ether"), gas: gas })
        .then(function(_success) {
            if (!_success) {
                throw new Error("The transaction will fail anyway, not sending");
            }

            // Perform the actual deposit
            return remittanceContract.deposit(exchangeAddress, duration, key, { from: window.account, value: web3.toWei(remitAmt, "ether"), gas: gas });
        })
        .then(function(txn) {
            console.log("txn: ", txn);
            $("#depositStatus").html("Transaction Hash is " + txn.tx);
            return updateStatus();
        })
        .catch(e => {
            $("#depositStatus").html(e.toString());
            console.error(e);
        });
};

// Withdraw Remittance Function
const withdrawRemittance = function() {
    let withdrawRecipientPwd, withdrawExchangePwd, secret;

    // We return the whole promise chain so that other parts of the UI can be informed when
    // it is done.
    withdrawRecipientPwd = $("#withdrawRecipientPwd").val();
    withdrawExchangePwd = $("#withdrawExchangePwd").val();

    console.log("withdrawRecipientPwd: ", withdrawRecipientPwd);
    console.log("withdrawExchangePwd: ", withdrawExchangePwd);

    secret = web3Utils.soliditySha3(withdrawRecipientPwd, withdrawExchangePwd);
    console.log("secret: ", secret);
    console.log("key: ", web3Utils.soliditySha3(window.exchangeAccount, secret));

    return remittanceContract.withdraw.call(secret, { from: window.exchangeAccount, gas: gas })
        .then(function(_success) {
            if (!_success) {
                throw new Error("The transaction will fail anyway, not sending");
            }

            // Perform the actual withdrawal
            return remittanceContract.withdraw(secret, { from: window.exchangeAccount, gas: gas });
        })
        .then(function(txn) {
            console.log("txn: ", txn);
            $("#withdrawStatus").html("Transaction Hash is " + txn.tx);
            return updateStatus();
        })
        .catch(e => {
            $("#withdrawStatus").html(e.toString());
            console.error(e);
        });
};

//Refund Remittance Function
const refundRemittance = function() {
    let exchangeAddress, recipientPwd, exchangePwd, key, secret;

    // We return the whole promise chain so that other parts of the UI can be informed when
    // it is done.
    exchangeAddress = $("#refundExchangeAddress").val();
    recipientPwd = $("#refundRecipientPwd").val();
    exchangePwd = $("#refundExchangePwd").val();

    console.log("exchangeAddress: ", exchangeAddress);
    console.log("recipientPwd: ", recipientPwd);
    console.log("exchangePwd: ", exchangePwd);

    secret = web3Utils.soliditySha3(recipientPwd, exchangePwd);
    key = web3Utils.soliditySha3(exchangeAddress, secret);
    console.log("key: ", key);

    return remittanceContract.refund.call(key, { from: window.account, gas: gas })
        .then(function(_success) {
            if (!_success) {
                throw new Error("The transaction will fail anyway, not sending");
            }

            // Perform the actual refund
            return remittanceContract.refund(key, { from: window.account, gas: gas });
        })
        .then(function(txn) {
            console.log("txn: ", txn);
            $("#refundStatus").html("Transaction Hash is " + txn.tx);
            return updateStatus();
        })
        .catch(e => {
            $("#refundStatus").html(e.toString());
            console.error(e);
        });
};

/*******************************
    Events Related Functions
********************************/
const eventWatcherLogDeposit = function() {
    return remittanceContract.LogDeposit({}, { fromBlock: 0 })
        .watch(function(err, newDeposit) {
            if (err) {
                console.log("Error watching deposit events: ", err);
            } else {
                console.log("Deposit Event: ", newDeposit);
                depositEventsArr.push(newDeposit);
                return updateStatus();
            }
        });
};

const eventWatcherLogWithdraw = function() {
    return remittanceContract.LogWithdraw({}, { fromBlock: 0 })
        .watch(function(err, newWithdraw) {
            if (err) {
                console.log("Error watching withdraw events: ", err);
            } else {
                console.log("Withdraw Event: ", newWithdraw);
                withdrawEventsArr.push(newWithdraw);
                return updateStatus();
            }
        });
};

const eventWatcherLogRefund = function() {
    return remittanceContract.LogRefund({}, { fromBlock: 0 })
        .watch(function(err, newRefund) {
            if (err) {
                console.log("Error watching refund events: ", err);
            } else {
                console.log("Refund Event: ", newRefund);
                refundEventsArr.push(newRefund);
                return updateStatus();
            }
        });
};

/*******************************
    GUI Related Functions
********************************/
// Update GUI status
const updateStatus = function() {
    $("#remitSenderAddress").val(window.account);
    $("#withdrawExchangeAddress").val(window.exchangeAccount);

    populateDepositTable(depositEventsArr);
    populateWithdrawTable(withdrawEventsArr);
    populateRefundTable(refundEventsArr);

    return web3.eth.getBalancePromise(window.account)
        .then(function(_balance) {
            $("#remitSenderBal").val(web3.fromWei(_balance, "ether") + " ETH");
            return web3.eth.getBalancePromise(window.exchangeAccount);
        })
        .then(function(_balance) {
            $("#withdrawExchangeBal").val(web3.fromWei(_balance, "ether") + " ETH");
            return web3.eth.getBalancePromise(remittanceContract.address);
        })
        .then(function(_balance){
            $("#curContractBalance").val(web3.fromWei(_balance, "ether") + " ETH");
            return web3.eth.getBlockNumberPromise();
        })
        .then(function(_blockNumber) {
            $("#curBlockNumber").val(_blockNumber);
        });
};

// Update deposit events table
const populateDepositTable = function(_array) {
    var rows = $.map(_array, function(value, index) {
        return "<tr>" +
            "<td>" + value.args.key + "</td>" +
            "<td>" + value.args.sender + "</td>" +
            "<td>" + value.args.receiver + "</td>" +
            "<td>" + value.args.deadline.toString(10) + "</td>" +
            "<td>" + web3.fromWei(value.args.amount, "ether") + " ETH</td>" +
            "</tr>";
    });
    $("#depositEventTbl tbody").html(rows.join(""));
};

// Update withdraw events table
const populateWithdrawTable = function(_array) {
    var rows = $.map(_array, function(value, index) {
        return "<tr>" +
            "<td>" + value.args.key + "</td>" +
            "<td>" + value.args.withdrawer + "</td>" +
            "<td>" + value.args.deadline.toString(10) + "</td>" +
            "<td>" + web3.fromWei(value.args.amount, "ether") + " ETH</td>" +
            "</tr>";
    });
    $("#withdrawEventTbl tbody").html(rows.join(""));
};

// Update refund events table
const populateRefundTable = function(_array) {
    var rows = $.map(_array, function(value, index) {
        return "<tr>" +
            "<td>" + value.args.key + "</td>" +
            "<td>" + value.args.sender + "</td>" +
            "<td>" + value.args.deadline.toString(10) + "</td>" +
            "<td>" + web3.fromWei(value.args.amount, "ether") + " ETH</td>" +
            "</tr>";
    });
    $("#refundEventTbl tbody").html(rows.join(""));
};

// Init all properties and register any events here.
window.addEventListener('load', function() {
    return web3.eth.getAccountsPromise()
        .then(accounts => {
            if (accounts.length < 3) {
                $("#remitSenderAddress").val("N/A");
                $("#withdrawExchangeAddress").val("N/A");
                
                throw new Error("Not enough account with which to transact. Require 3 accounts at least.");
            }
            window.account = accounts[1];
            window.exchangeAccount = accounts[2];
            console.log("Account:", window.account);
            console.log("Exchange Account:", window.exchangeAccount);
            return web3.version.getNetworkPromise();
        })
        .then(network => {
            console.log("Network:", network.toString(10));
            return Remittance.deployed();
        })
        .then(function(_instance) {
            remittanceContract = _instance;
            console.log("Contract:", remittanceContract);

            // Register deposit event watcher
            return eventWatcherLogDeposit();
        })
        // Register withdraw event watcher
        .then(() => eventWatcherLogWithdraw())
        // Register refund event watcher
        .then(() => eventWatcherLogRefund())
        // Update GUI
        .then(() => updateStatus())
        // Map click event for remittance deposit.
        .then(() => $("#depositBtn").click(depositRemittance))
        // Map click event for remittance withdrawal.
        .then(() => $("#withdrawBtn").click(withdrawRemittance))
        // Map click event for remittance refund.
        .then(() => $("#refundBtn").click(refundRemittance))
        // Never let an error go unlogged.
        .catch(console.error);
});