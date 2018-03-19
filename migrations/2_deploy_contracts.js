var Remittance = artifacts.require("./Remittance.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(Remittance);
};
