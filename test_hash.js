const {Web3} = require("web3");
function hashToAddress(chainid, addr) {
    // Convert chainid and addr to their respective buffer representations
    web3 = new Web3();
    const input_data = web3.eth.abi.encodeParameters(["uint256", "address"], [chainid, addr]);
    // Concatenate and hash
    console.log("input data ", input_data);
    const hash = web3.utils.keccak256(input_data);
    // Take the first 20 bytes (160 bits) of the hash and convert to address
    const address = "0x" + hash.slice(26);
    console.log("hash data ", hash);
    return address;
}

// Example usage:
const chainid = 1; // Replace with your chainid
const addr = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4'; // Replace with your address
// 0xD8453f94A2BC339cd41cBEdF2Cdb4613Ac237e33
console.log(hashToAddress(chainid, addr));
