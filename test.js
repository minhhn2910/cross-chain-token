const { Web3 } = require("web3");
const fs = require("fs");
require("dotenv").config({ path: "dev.env" });
// Connect to the Ganache

console.log(process.env.RPC_NODES);
var rpc_nodes = process.env.RPC_NODES.split(",");
var web3_instances = [];
for (var i = 0; i < rpc_nodes.length; i++) {
  rpc_nodes[i] = rpc_nodes[i].trim();
  web3_instances.push(new Web3(rpc_nodes[i]));
}

let sender = process.env.SENDER_ADDRESS;

function hashToAddress (chainid, addr) {
  // Convert chainid and addr to their respective buffer representations
  web3_instance = web3_instances[0];
  const input_data = web3_instance.eth.abi.encodeParameters(
    ["uint256", "address"],
    [chainid, addr]
  );
  const hash = web3_instance.utils.keccak256(input_data);
  // Take the first 20 bytes (160 bits) of the hash and convert to address
  const address = "0x" + hash.slice(26);
  return address;
};
function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}
const poll_balance_result = async function (contract_instances) {
  console.log("=================== Check balance ===================");

  for (var i = 0; i < contract_instances.length; i++) {
    const balance = await contract_instances[0].methods
      .balanceOf(crosschain_addresses[i])
      .call();
    console.log("Balance of sender on chain ", i, " is ", balance);
    if (balance != (i+1)*100) {
      setTimeout(poll_balance_result, 2000, contract_instances);
      return;
    }
  }
  console.log("All balances are correct");
}

const deploy_multiple_chain = async function (json_contract, web3_instances) {
  const json_output = JSON.parse(fs.readFileSync(json_contract, "utf8"));
  contract_key = "contracts/CrossERC20.sol:RemoteERC20";
  const contract_abi = json_output.contracts[contract_key].abi;
  var bytecode = json_output.contracts[contract_key].bin;

  var contract_instances = [];

  for (var i = 0; i < web3_instances.length; i++) {
    web3_instance = web3_instances[i];
    const RERC20Interface = new web3_instance.eth.Contract(contract_abi);
    const tx_receipt = await RERC20Interface.deploy({
      data: bytecode,
      arguments: [i + 1, i == 0], // fake chainid, isHost
    }).send({
      from: sender,
      gas: 5000000,
      gasPrice: "30000000000000",
    });
    const contract_instance = new web3_instance.eth.Contract(
      contract_abi,
      tx_receipt._address
    );
    contract_instances.push(contract_instance);
    console.log(
      "Blockchain ",
      i,
      " Contract deployed at address",
      tx_receipt._address
    );
  }

  const contract_addresses = contract_instances.map((obj) => obj._address);
  // initialize the remote contracts
  for (var i = 1; i < web3_instances.length; i++) {
    await contract_instances[i].methods
      .initialize_host_contract(contract_addresses[0])
      .send({ from: sender, gas: 5000000 });
    console.log(
      "init host contract on chain ",
      i,
      " with address ",
      contract_addresses[0]
    );
  }

  console.log("=================== Minting sessions ===================");
  for (var i = 0; i < web3_instances.length; i++) {
    await contract_instances[i].methods
      .mint((i+1)*100)
      .send({ from: sender, gas: 5000000 });
  }
  crosschain_addresses = contract_addresses.map((obj, idx) =>
    hashToAddress(idx + 1, sender)
  );
  console.log("crosschain addresses ", crosschain_addresses);

  await delay(2000);
  poll_balance_result(contract_instances);
  await delay(1000);
  console.log("=================== Remote transfer ===================");
  for (var i = 1; i < web3_instances.length; i++) {
    console.log("Transfer from chain ", i, " to chain ", 0, " amount ", 100);
    await contract_instances[i].methods.transfer(crosschain_addresses[0], 100).send({ from: sender, gas: 5000000 });
  }

  await delay(2000);

  for (var i = 0; i < contract_instances.length; i++) {
    const balance = await contract_instances[0].methods
      .balanceOf(crosschain_addresses[i])
      .call();
    console.log("Balance of sender on chain ", i, " is ", balance);
  }
};

deploy_multiple_chain("contracts/cross_erc20.json", web3_instances);
