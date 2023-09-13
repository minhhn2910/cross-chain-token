# Cross-Chain Token (Remote Controlled)
Test POC cross-chain token runs on N blockchains. There is 1 host blockchain hosting the token. Other accounts on other blockchains will control the host contract remotely.

## Features:
The host contract on the host blockchain holds the balance states, while the other `N-1` contracts on `N-1` blockchains remote controlled it by message passing.
Each sender will have a unique id accross blockchain by hashing the `chain_id` concatenated with `account_address`

Each blockchain is a single `ganache-cli` process running on a different port. All have the same account with enough ETH for gas.

This repo simulates the behavior of the simplest form of remoted controlled cross-chain token that only serves minting and transfer remotely to anyone. Full token functionality or other more complex schemes are not implemented. Because there is no security mechanism in place, this setup should be used for demonstration purposes only.

### Code files

* `contracts/CrossERC20.sol` : the remote controlled Token with a unified logic that applied to all of the participating blockchains
* `bridge.js`: the simple notary bridge service listening to relevant events on all chains
* `test.js` : the test scenario to deploy, init remote token contracts, minting, and transferring.

### Run Test:
1. Clone this project and make sure `node v16` is installed:
```
git clone https://github.com/minhhn2910/cross-chain-voting.git
```

2. Install dependencies:

```
cd cross-chain-voting
npm install
npm install -g ganache-cli # skip this if you already have ganache installed.
```

3. Run end-to-end test:

```
./run_experiment.sh
```

You should see some output like this :

```
Blockchain  0  Contract deployed at address 0xc010C027c557dB20F5A0cE653Cca257A3De24843
Blockchain  1  Contract deployed at address 0xc010C027c557dB20F5A0cE653Cca257A3De24843
Blockchain  2  Contract deployed at address 0xc010C027c557dB20F5A0cE653Cca257A3De24843
init host contract on chain  1  with address  0xc010C027c557dB20F5A0cE653Cca257A3De24843
init host contract on chain  2  with address  0xc010C027c557dB20F5A0cE653Cca257A3De24843

=================== Minting sessions ===================
crosschain addresses  [
  '0x9281881856c0d6ff4e70649d7cd617641e563580',
  '0x2065e565c6b27c47a001a566286ae4940823f770',
  '0x536459f36ecc6b56f030d170c3a155dc09be2ab0'
]

... other bridge logs

=================== Check balance ===================
Balance of sender on chain  0  is  100n
Balance of sender on chain  1  is  200n
Balance of sender on chain  2  is  300n
All balances are correct

... other bridge logs

=================== Remote transfer ===================
Transfer from chain  1  to chain  0  amount  100
Transfer from chain  2  to chain  0  amount  100

... other bridge logs

Balance of sender on chain  0  is  300n
Balance of sender on chain  1  is  100n
Balance of sender on chain  2  is  200n

```
Sample run can be viewed from [Github Action](https://github.com/minhhn2910/cross-chain-token/actions)
