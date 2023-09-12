const { Web3 } = require("web3");
const fs = require("fs");
const express = require("express");
const e = require("express");
require("dotenv").config({ path: "dev.env" });
console.log(process.env.RPC_NODES);
var rpc_nodes = process.env.RPC_NODES.split(",");
var web3_instances = [];
for (var i = 0; i < rpc_nodes.length; i++) {
  rpc_nodes[i] = rpc_nodes[i].trim();
  web3_instances.push(new Web3(rpc_nodes[i]));
}

const event_abi = {
  RecvERC20Message: {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "enum RemoteERC20.Operation",
        name: "op",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "RecvERC20Message",
    type: "event",
  },
  SendERC20Message: {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "nonce",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "senderCrosschainId",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "remoteContract",
        type: "address",
      },
      {
        indexed: false,
        internalType: "enum RemoteERC20.Operation",
        name: "op",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "SendERC20Message",
    type: "event",
  },
  Transfer: {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
};

// ABI for the SendMessage event
const sendMessageEventSignature =
  web3_instances[0].eth.abi.encodeEventSignature(event_abi.SendERC20Message);
const receiveMessageEventSignature =
  web3_instances[0].eth.abi.encodeEventSignature(event_abi.RecvERC20Message);
const transferEventSignature = web3_instances[0].eth.abi.encodeEventSignature(
  event_abi.Transfer
);

file_name = "contracts/cross_erc20.json";
const json_output = JSON.parse(fs.readFileSync(file_name, "utf8"));
// console.log("json_output " , json_output);
contract_key = "contracts/CrossERC20.sol:RemoteERC20";
const contractABI = json_output.contracts[contract_key].abi;

async function processBlock(blockNumber, web3_instance, chain_id) {
  const block = await web3_instance.eth.getBlock(blockNumber, true);

  for (const tx of block.transactions) {
    if (tx.to && tx.input !== "0x") {
      // Check if it's a contract call
      const receipt = await web3_instance.eth.getTransactionReceipt(tx.hash);
      for (const log of receipt.logs) {
        if (log.topics[0] === sendMessageEventSignature) {
          const event = web3_instance.eth.abi.decodeLog(
            event_abi.SendERC20Message.inputs,
            log.data,
            log.topics.slice(1)
          );
          console.log(
            "\n Event send message ",
            "\n Nonce",
            event.nonce,
            "\n Sender",
            event.senderCrosschainId,
            "\n Receiver",
            event.remoteContract,
            "\n Operation",
            event.op,
            "\n Data",
            event.data
          );
          // submit a tx to rpm node at receiver rank
          try {
            // The first web3 instance is the host chain. Simple setup for now.
            const receiver_web3_instance = web3_instances[0];
            const accounts = await receiver_web3_instance.eth.getAccounts();
            const receiver_contract = new receiver_web3_instance.eth.Contract(
              contractABI,
              event.remoteContract
            );
            // recv_message(uint nonce, Operation op, bytes memory data)
            const tx = await receiver_contract.methods
              .recv_message(event.nonce, event.op, event.data)
              .send({
                from: accounts[0],
                gas: 2000000,
              });
            console.log(
              "Transaction",
              tx.transactionHash,
              " sent from ",
              chain_id,
              " to host contract "
            );
          } catch (err) {
            console.error(
              "Error sending transaction to destination blockchain:",
              err
            );
          }
        }
        if (chain_id == 0 && log.topics[0] === receiveMessageEventSignature) {
          const event = web3_instance.eth.abi.decodeLog(
            event_abi.RecvERC20Message.inputs,
            log.data,
            log.topics.slice(1)
          );
          console.log(
            "\n Event receive message ",
            "\n Operation",
            event.op,
            "\n Data",
            event.data
          );
        }
        if (chain_id == 0 && log.topics[0] === transferEventSignature) {
          const event = web3_instance.eth.abi.decodeLog(
            event_abi.Transfer.inputs,
            log.data,
            log.topics.slice(1)
          );
          console.log(
            "\n Event transfer ",
            "\n From",
            event.from,
            "\n To",
            event.to,
            "\n Value",
            event.value
          );
        }
      }
    }
  }
}

var lastProcessedBlocks = new Array(web3_instances.length).fill(0);

async function pollNewBlocks() {
  for (var i = 0; i < web3_instances.length; i++) {
    const latestBlock = await web3_instances[i].eth.getBlockNumber();
    // console.log("Process latest block " + latestBlock + " on chain " + i);
    while (lastProcessedBlocks[i] < latestBlock) {
      lastProcessedBlocks[i]++;
      await processBlock(lastProcessedBlocks[i], web3_instances[i], i);
    }
  }
  setTimeout(pollNewBlocks, 2000); // Check every 15 seconds
}
console.log(" Listening for new events...");
pollNewBlocks();
