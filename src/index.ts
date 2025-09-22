import 'dotenv/config';
import { WebSocketServer } from 'ws';
import Client, { SubscribeRequest } from '@triton-one/yellowstone-grpc';

const YELLOWSTONE_ENDPOINT = process.env.YELLOWSTONE_ENDPOINT || 'https://api.rpcpool.com:443';
const YELLOWSTONE_TOKEN = process.env.YELLOWSTONE_TOKEN || 'your_token_here';
const WEBSOCKET_PORT = parseInt(process.env.WEBSOCKET_PORT || '8080');

const client = new Client(YELLOWSTONE_ENDPOINT, YELLOWSTONE_TOKEN, undefined);

let currentSubscriptions: { [key: string]: string[] } = {}; // label -> addresses

// Test gRPC connection before starting WebSocket server
async function testGrpcConnection(): Promise<boolean> {
  try {
    console.log('🔍 Testing gRPC connection...');

    // Try to get version info to test connection
    const version = await client.getVersion();
    console.log('✅ gRPC connection successful!');
    console.log(`📊 Yellowstone version info:`, version);

    return true;
  } catch (error) {
    console.error('❌ gRPC connection failed:', error instanceof Error ? error.message : String(error));
    console.error('💡 Check your YELLOWSTONE_ENDPOINT and YELLOWSTONE_TOKEN in .env');
    return false;
  }
}

// Start the server
async function startServer() {
  console.log(`🌐 Starting WebSocket server on port ${WEBSOCKET_PORT}`);
  console.log(`🔗 Yellowstone endpoint: ${YELLOWSTONE_ENDPOINT}`);

  // Test gRPC connection first
  const grpcConnected = await testGrpcConnection();
  if (!grpcConnected) {
    console.error('🚫 Server startup aborted due to gRPC connection failure');
    process.exit(1);
  }

  // Start WebSocket server
  const wss = new WebSocketServer({ port: WEBSOCKET_PORT });

  console.log(`✅ WebSocket server started successfully on port ${WEBSOCKET_PORT}`);
  console.log(`🚀 Server is ready to accept connections!`);

  wss.on('connection', (ws) => {
    console.log('🔗 Python server connected');

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(message, ws);
      } catch (error) {
        console.error('❌ Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('🔌 Python server disconnected');
    });
  });

  return wss;
}

// Initialize server
startServer().then((wss) => {
  // Store wss for use in other functions
  (globalThis as any).wssInstance = wss;
}).catch((error) => {
  console.error('💥 Failed to start server:', error);
  process.exit(1);
});

async function handleMessage(message: any, ws: any) {
  if (message.type === 'subscribe') {
    const { tokens } = message; // array of { mint: string, creator: string }
    console.log(`📋 Received subscription request for ${tokens.length} token(s)`);
    await updateSubscriptions(tokens);
  } else {
    console.log(`❓ Received unknown message type: ${message.type}`);
  }
}

async function updateSubscriptions(tokens: { mint: string; creator: string }[]) {
  // Clear existing subscriptions
  await unsubscribeAll();

  // Create new subscription request
  const request: SubscribeRequest = {
    slots: { slots: {} },
    accounts: {},
    transactions: {},
    blocks: {},
    blocksMeta: {},
    accountsDataSlice: [],
    entry: {},
    commitment: 1, // confirmed
  };

  // Add accounts for each token
  tokens.forEach((token, index) => {
    const label = `token_${index}`;
    request.accounts![label] = {
      account: [token.mint, token.creator],
      owner: [],
      filters: [],
    };
    currentSubscriptions[label] = [token.mint, token.creator];
  });

  // Subscribe to transactions mentioning these accounts
  request.transactions!['token_txs'] = {
    vote: false,
    failed: false,
    accountInclude: tokens.flatMap(t => [t.mint, t.creator]),
    accountExclude: [],
    accountRequired: [],
  };

  // Send subscription
  const stream = await client.subscribe();

  stream.on('data', (data: any) => {
    // Log data type for debugging
    if (data.account) {
      console.log(`📊 Account update received for: ${data.account.account.pubkey}`);
    } else if (data.transaction) {
      console.log(`💸 Transaction received: ${data.transaction.transaction.signature}`);
    } else if (data.slot) {
      console.log(`🎰 Slot update: ${data.slot.slot}`);
    } else if (data.pong) {
      console.log(`🏓 Pong received: ${data.pong.id}`);
    } else {
      console.log(`📦 Unknown data type received:`, Object.keys(data));
    }

    // Process data and send to WebSocket
    broadcastData(data);
  });

  stream.on('error', (error: any) => {
    console.error('Stream error:', error);
  });

  await new Promise<void>((resolve, reject) => {
    stream.write(request, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });

  console.log(`🔄 Subscribed to ${tokens.length} tokens`);
}

async function unsubscribeAll() {
  console.log('🔄 Unsubscribing from all streams...');
  const stream = await client.subscribe();
  const emptyRequest: SubscribeRequest = {
    slots: {},
    accounts: {},
    transactions: {},
    blocks: {},
    blocksMeta: {},
    accountsDataSlice: [],
    entry: {},
  };

  await new Promise<void>((resolve, reject) => {
    stream.write(emptyRequest, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
  console.log('✅ Unsubscribed from all streams');
}

function broadcastData(data: any) {
  const wss = (globalThis as any).wssInstance;
  if (!wss) {
    console.warn('⚠️ WebSocket server not initialized');
    return;
  }

  let connectedClients = 0;
  wss.clients.forEach((client: any) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data));
      connectedClients++;
    }
  });

  if (connectedClients > 0) {
    console.log(`📤 Broadcasted data to ${connectedClients} client(s)`);
  }
}

// Keep the stream alive with pings
setInterval(async () => {
  const pingRequest: SubscribeRequest = {
    ping: { id: Date.now() },
    accounts: {},
    accountsDataSlice: [],
    transactions: {},
    blocks: {},
    blocksMeta: {},
    entry: {},
    slots: {},
  };

  const stream = await client.subscribe();
  await new Promise<void>((resolve, reject) => {
    stream.write(pingRequest, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}, 30000);

// Handle pong responses
(async () => {
  const stream = await client.subscribe();
  stream.on('data', (data: any) => {
    if (data.pong) {
      console.log('Received Pong response');
    }
  });
})();