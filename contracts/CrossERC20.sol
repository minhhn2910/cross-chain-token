// SPDX-License-Identifier: MIT
/*
This is a simple ERC20 contract that can be remotely used on another chain.
It is used to demonstrate a testing proof of concept for the cross-chain native token without lock and mint mechanism
The balance sheet is stored on the host blockchain. Any account can be accessed by any blockchains.
There is no security check in this contract, so it MUST NOT be used in production.
The source code inspired from Solidity by Example
*/
pragma solidity ^0.8.0;

contract RemoteERC20 {
    uint public totalSupply;
    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;
    string public name = "Remote Controlled ERC20";
    string public symbol = "RC20";
    uint8 public decimals = 18;
    uint public chainid; //for simplicity of testing purpose, we dont read the real chain id but set it manually
    bool public is_host_chain; //is this chain the host chain. There must only 1 host chain during initialization.
    address public host_contract; // storing the host contract address for simplicity of testing purpose
    struct CrossChainID {
        uint256 chainid;
        address addr;
    }
    enum Operation { //define the operation type of the message
        Others,
        Mint,
        Transfer,
        TransferFrom,
        Approve
    }
    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
    event SendERC20Message(
        uint nonce,
        address senderCrosschainId,
        address remoteContract,
        Operation op,
        bytes data
    );
    event RecvERC20Message(Operation op, bytes data);
    mapping (uint => bool ) public message_nonce; // whether a nonce is executed to avoid double execution
    mapping (address => uint ) public local_nonce;
    // to avoid duplication Nonce is simply hash (local_nonce, cross_chain_addr); each blockchain tracks its own nonce.
    // This is only a poc implementation without careful design to avoid collisions and replay etc.

    constructor(uint chainid_, bool is_host_chain_){
        chainid = chainid_;
        is_host_chain = is_host_chain_;
    }

    function initialize_host_contract(address host_contract_) public {
        host_contract = host_contract_;
    }
    function transfer(address recipient, uint amount) external returns (bool) {
        address crosschain_address = get_crosschain_address(CrossChainID(chainid, msg.sender));
        // design choice: encode and resolve the receipient offchain and not here
        // receipient is retreived from get_crosschain_address off-chain before submitting tx
        if (is_host_chain)
            _transfer(crosschain_address, recipient, amount);
        else{
            local_nonce[msg.sender] += 1;
            _send_message(get_crosschain_nonce(local_nonce[msg.sender]), crosschain_address, Operation.Transfer, abi.encode(crosschain_address, recipient, amount));
        }
        return true;
    }

    function approve(address spender, uint amount) public returns (bool) {
        // NOT implemented for simplicity of testing purpose
    }
    function approve_from(address owner, address spender, uint amount) internal {
        // NOT implemented for simplicity of testing purpose
    }

    function transferFrom(
        address sender,
        address recipient,
        uint amount
    ) external returns (bool) {
        // Approval and transferFrom are not implemented for simplicity of testing purpose
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "Invalid sender");
        require(recipient != address(0), "Invalid recipient");
        require(balanceOf[sender] >= amount, "Insufficient balance");

        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;

        emit Transfer(sender, recipient, amount);
    }
    function mint(uint amount) external {
        address crosschain_address = get_crosschain_address(CrossChainID(chainid, msg.sender));
        if (is_host_chain)
            _mint(crosschain_address, amount);
        else{
            local_nonce[msg.sender] += 1;
            _send_message(get_crosschain_nonce(local_nonce[msg.sender]), crosschain_address, Operation.Mint, abi.encode(crosschain_address, amount));
        }

    }

    function _mint(address receiver, uint amount) internal {
        require(receiver != address(0), "Invalid account");
        totalSupply += amount;
        balanceOf[receiver] += amount;
        emit Transfer(address(0), receiver, amount);
    }

    struct Message {
        uint256 nonce;
        address senderCrosschainId;
        address remoteContract;
        Operation op;
        bytes data;
    }

    Message public last_message; // simple retry logic for one message only

    function retry_last_message() public {
        emit SendERC20Message(
            last_message.nonce,
            last_message.senderCrosschainId,
            last_message.remoteContract,
            last_message.op,
            last_message.data
        );
    }

    function _send_message(uint nonce, address senderCrosschainId, Operation op , bytes memory data) internal {
        require (host_contract != address(0), "Host contract not initialized");
        // TODO: retry logic for different senders. This one only retry a single msg
        emit SendERC20Message(nonce, senderCrosschainId, host_contract, op, data);
        last_message = Message({
            nonce: nonce,
            senderCrosschainId: senderCrosschainId,
            remoteContract: host_contract,
            op: op,
            data: data
        });

    }
    function recv_message(uint nonce, Operation op, bytes memory data) external {
        require (is_host_chain, "Only host chain can receive message");
        require (message_nonce[nonce] == false, "Message already executed");
        emit RecvERC20Message(op, data);
        if (op == Operation.Transfer) {
            (address sender, address recipient, uint amount) = abi.decode(data, (address, address, uint256));
            _transfer(sender, recipient, amount);
        } else if (op == Operation.Mint) {
            (address receiver, uint amount) = abi.decode(data, (address, uint256));
            _mint(receiver, amount);
        } else {
            revert("Operation not supported yet");
        }
    }

    function get_crosschain_address(CrossChainID memory _id) public pure returns (address) {
        bytes32 hash = keccak256(abi.encode(_id.chainid, _id.addr));
        return address(uint160(uint256(hash)));
    }
    function get_crosschain_nonce(uint local_nonce_) public view returns (uint) {
        return uint(keccak256(abi.encode(local_nonce_, get_crosschain_address(CrossChainID(chainid, msg.sender)))));
    }

}
