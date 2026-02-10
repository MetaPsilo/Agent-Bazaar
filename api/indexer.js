/**
 * Solana Program Indexer for Agent Bazaar
 * Watches on-chain events and indexes into SQLite
 */
require("dotenv").config();
const { Connection, PublicKey } = require("@solana/web3.js");
const Database = require("better-sqlite3");
const path = require("path");
const { safePreparedStatement } = require("./security-middleware");

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.PROGRAM_ID;

if (!PROGRAM_ID) {
  console.error("PROGRAM_ID not set in .env");
  process.exit(1);
}

const connection = new Connection(RPC_URL, "confirmed");
const programId = new PublicKey(PROGRAM_ID);
const db = new Database(path.join(__dirname, "bazaar.db"));

// Borsh deserialization helpers (with validation)
function readString(buf, offset, maxLength = 1000) {
  try {
    if (offset + 4 > buf.length) throw new Error("Buffer underrun reading string length");
    
    const len = buf.readUInt32LE(offset);
    if (len > maxLength) throw new Error(`String too long: ${len} > ${maxLength}`);
    if (offset + 4 + len > buf.length) throw new Error("Buffer underrun reading string data");
    
    let str = buf.slice(offset + 4, offset + 4 + len).toString("utf8");
    
    // SECURITY: Strip null bytes and control characters from on-chain data
    // Attacker could register agents with malicious names on-chain
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return [str, offset + 4 + len];
  } catch (error) {
    console.error("String deserialization error:", error);
    throw error;
  }
}

function readU64(buf, offset) {
  if (offset + 8 > buf.length) throw new Error("Buffer underrun reading U64");
  return [Number(buf.readBigUInt64LE(offset)), offset + 8];
}

function readI64(buf, offset) {
  if (offset + 8 > buf.length) throw new Error("Buffer underrun reading I64");
  return [Number(buf.readBigInt64LE(offset)), offset + 8];
}

function readPubkey(buf, offset) {
  if (offset + 32 > buf.length) throw new Error("Buffer underrun reading Pubkey");
  const key = new PublicKey(buf.slice(offset, offset + 32));
  return [key.toBase58(), offset + 32];
}

async function indexAllAgents() {
  console.log("Indexing all agents from on-chain...");

  // Get protocol state
  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol")],
    programId
  );

  try {
    const protocolInfo = await connection.getAccountInfo(protocolPda);
    if (!protocolInfo) {
      console.log("Protocol not initialized yet");
      return;
    }

    const data = protocolInfo.data;
    // Skip 8-byte discriminator
    let offset = 8;
    let authority, agentCount, platformFeeBps;
    [authority, offset] = readPubkey(data, offset);
    [agentCount, offset] = readU64(data, offset);
    [platformFeeBps] = [data.readUInt16LE(offset), offset + 2];

    console.log(`Protocol: ${agentCount} agents, ${platformFeeBps} bps fee`);

    db.prepare("UPDATE protocol_stats SET total_agents = ?, platform_fee_bps = ? WHERE id = 1")
      .run(agentCount, platformFeeBps);

    // Index each agent
    for (let i = 0; i < agentCount; i++) {
      const idBuf = Buffer.alloc(8);
      idBuf.writeBigUInt64LE(BigInt(i));

      const [agentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), idBuf],
        programId
      );
      const [repPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation"), idBuf],
        programId
      );

      try {
        const agentInfo = await connection.getAccountInfo(agentPda);
        if (!agentInfo) continue;

        const d = agentInfo.data;
        let off = 8; // skip discriminator
        let agentId, owner, agentWallet, name, description, agentUri, active, registeredAt, updatedAt;
        [agentId, off] = readU64(d, off);
        [owner, off] = readPubkey(d, off);
        [agentWallet, off] = readPubkey(d, off);
        [name, off] = readString(d, off);
        [description, off] = readString(d, off);
        [agentUri, off] = readString(d, off);
        active = d.readUInt8(off); off += 1;
        [registeredAt, off] = readI64(d, off);
        [updatedAt, off] = readI64(d, off);

        db.prepare(`
          INSERT OR REPLACE INTO agents (agent_id, owner, agent_wallet, name, description, agent_uri, active, registered_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(agentId, owner, agentWallet, name, description, agentUri, active, registeredAt, updatedAt);

        // Index reputation
        const repInfo = await connection.getAccountInfo(repPda);
        if (repInfo) {
          const r = repInfo.data;
          let rOff = 8;
          let repAgentId, totalRatings, ratingSum, totalVolume, uniqueRaters;
          [repAgentId, rOff] = readU64(r, rOff);
          [totalRatings, rOff] = readU64(r, rOff);
          [ratingSum, rOff] = readU64(r, rOff);
          [totalVolume, rOff] = readU64(r, rOff);
          [uniqueRaters, rOff] = readU64(r, rOff);

          const dist = [];
          for (let s = 0; s < 5; s++) {
            let val;
            [val, rOff] = readU64(r, rOff);
            dist.push(val);
          }

          db.prepare(`
            INSERT OR REPLACE INTO reputation (agent_id, total_ratings, rating_sum, total_volume, unique_raters, rating_distribution)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(agentId, totalRatings, ratingSum, totalVolume, uniqueRaters, JSON.stringify(dist));
        }

        console.log(`  Indexed agent ${agentId}: ${name}`);
      } catch (e) {
        console.error(`  Error indexing agent ${i}:`, e.message);
      }
    }
  } catch (e) {
    console.error("Error indexing:", e.message);
  }
}

// Run indexer
indexAllAgents().then(() => {
  console.log("Indexing complete.");

  // Set up polling (every 30 seconds)
  setInterval(indexAllAgents, 30000);
  console.log("Polling every 30s for updates...");
});
