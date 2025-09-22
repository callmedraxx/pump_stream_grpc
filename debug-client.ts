import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8080';

// Test data - replace with actual token addresses
const testTokens = [
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    creator: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  }
];

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');

  // Send subscription request
  const message = {
    type: 'subscribe',
    tokens: testTokens
  };

  ws.send(JSON.stringify(message));
  console.log('📤 Sent subscription request:', message);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());

    // Log the full data structure for analysis
    console.log('📥 Full data structure:', JSON.stringify(message, null, 2));

    // Analyze the data type
    if (message.account) {
      console.log('📊 ACCOUNT UPDATE:', {
        pubkey: message.account.account.pubkey,
        owner: message.account.account.owner,
        lamports: message.account.account.lamports,
        dataLength: message.account.account.data?.length,
        slot: message.account.slot
      });
    } else if (message.transaction) {
      console.log('💸 TRANSACTION:', {
        signature: message.transaction.transaction.signature,
        slot: message.transaction.slot,
        accounts: message.transaction.transaction.accountKeys?.length,
        success: !message.transaction.transaction.err
      });
    } else if (message.slot) {
      console.log('🎰 SLOT UPDATE:', {
        slot: message.slot.slot,
        parent: message.slot.parent,
        status: message.slot.status
      });
    }

  } catch (error) {
    console.log('📥 Received raw data:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Closing connection...');
  ws.close();
  process.exit(0);
});