import WebSocket from 'ws';
import { PublicKey } from '@solana/web3.js';

const WS_URL = 'ws://localhost:8080';

// Known program IDs for analysis
const PROGRAMS = {
  RAYDIUM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  ORCA: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
  JUPITER: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  PUMP_FUN: '6EF8rrecthR5Dkzon8NQtpjxarYgv3RdKCZTmL81teb',
  TOKEN_PROGRAM: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  SYSTEM_PROGRAM: '11111111111111111111111111111112'
};

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');

  const message = {
    type: 'subscribe',
    tokens: [{
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      creator: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    }]
  };

  ws.send(JSON.stringify(message));
  console.log('📤 Sent subscription request');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());

    if (message.transaction) {
      analyzeTransaction(message.transaction);
    }

  } catch (error) {
    console.log('📥 Received raw data:', data.toString());
  }
});

function bufferToPubkey(buffer: any): string {
  if (buffer.type === 'Buffer') {
    return new PublicKey(Buffer.from(buffer.data)).toString();
  }
  return buffer;
}

function analyzeTransaction(txData: any) {
  const tx = txData.transaction;
  const signature = bufferToPubkey(tx.signature);
  const slot = txData.slot;

  console.log(`\n🔍 Analyzing Transaction: ${signature}`);
  console.log(`📊 Slot: ${slot}`);
  console.log(`✅ Success: ${!tx.transaction.err}`);

  // Analyze account keys
  const accountKeys = tx.transaction.message.accountKeys.map((key: any) =>
    bufferToPubkey(key)
  );

  console.log(`👥 Accounts involved: ${accountKeys.length}`);
  console.log(`🔑 Signer: ${accountKeys[0]}`);

  // Analyze instructions
  const instructions = tx.transaction.message.instructions;
  console.log(`📝 Instructions: ${instructions.length}`);

  instructions.forEach((ix: any, index: number) => {
    const programId = accountKeys[ix.programIdIndex];
    console.log(`  ${index + 1}. Program: ${getProgramName(programId)}`);

    // Parse instruction data for known programs
    if (programId === PROGRAMS.TOKEN_PROGRAM) {
      parseTokenInstruction(ix, accountKeys);
    } else if (programId === PROGRAMS.SYSTEM_PROGRAM) {
      parseSystemInstruction(ix, accountKeys);
    }
  });

  // Analyze inner instructions (DEX swaps, etc.)
  if (tx.meta?.innerInstructions) {
    console.log(`🔄 Inner Instructions: ${tx.meta.innerInstructions.length}`);
    tx.meta.innerInstructions.forEach((inner: any) => {
      console.log(`  Inner IX ${inner.index}:`);
      inner.instructions.forEach((ix: any) => {
        const programId = accountKeys[ix.programIdIndex];
        console.log(`    - ${getProgramName(programId)}`);
      });
    });
  }

  // Extract token transfers from logs
  if (tx.meta?.logMessages) {
    extractTokenTransfers(tx.meta.logMessages);
  }

  console.log('─'.repeat(50));
}

function getProgramName(programId: string): string {
  for (const [name, id] of Object.entries(PROGRAMS)) {
    if (programId === id) return name;
  }
  return programId.slice(0, 8) + '...';
}

function parseTokenInstruction(ix: any, accountKeys: string[]) {
  if (ix.data && ix.data.type === 'Buffer') {
    const instructionType = ix.data.data[0];
    console.log(`    Token Instruction Type: ${instructionType}`);

    // 3 = Transfer, 12 = TransferChecked
    if (instructionType === 3 || instructionType === 12) {
      console.log(`    💸 TOKEN TRANSFER detected!`);
    }
  }
}

function parseSystemInstruction(ix: any, accountKeys: string[]) {
  if (ix.data && ix.data.type === 'Buffer') {
    const instructionType = ix.data.data[0];
    console.log(`    System Instruction Type: ${instructionType}`);

    // 2 = Transfer SOL
    if (instructionType === 2) {
      console.log(`    💰 SOL TRANSFER detected!`);
    }
  }
}

function extractTokenTransfers(logs: string[]) {
  const transfers: any[] = [];

  logs.forEach(log => {
    // Look for transfer logs
    if (log.includes('Transfer')) {
      console.log(`    📋 ${log}`);
    }

    // Extract amounts from logs (this is simplified)
    const amountMatch = log.match(/amount: (\d+)/);
    if (amountMatch) {
      console.log(`    💵 Amount: ${amountMatch[1]}`);
    }
  });
}

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
});

process.on('SIGINT', () => {
  console.log('\n👋 Closing connection...');
  ws.close();
  process.exit(0);
});