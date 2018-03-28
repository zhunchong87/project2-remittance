var Remittance = artifacts.require("./Remittance.sol");

module.exports = function(deployer, network, accounts) {
	// Remittance(address _remittanceExchange, uint _durationLimit, uint _commissionRate, bool isActive)
  deployer.deploy(Remittance, accounts[2], 10, 10, true);
};
