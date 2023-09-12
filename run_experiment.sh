# Start 3 blockchains and capture their PIDs
ganache-cli --account="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef,100000000000000000000000000" -p 8545 > /dev/null 2>&1 &
PID1=$!
ganache-cli --account="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef,100000000000000000000000000" -p 8646 > /dev/null 2>&1 &
PID2=$!
ganache-cli --account="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef,100000000000000000000000000" -p 8747 > /dev/null 2>&1 &
PID3=$!

sleep 1

# Run bridge and capture its PID
node bridge.js &
BRIDGE_PID=$!

sleep 1

# Run test
node test.js

# Kill the specific ganache-cli and bridge.js processes using their PIDs
kill $PID1 $PID2 $PID3 $BRIDGE_PID
