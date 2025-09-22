import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8080';

// Test data - replace with actual token addresses
const testTokens = [
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    creator: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // Using same for demo
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
    console.log('📥 Received data:', JSON.stringify(message, null, 2));
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