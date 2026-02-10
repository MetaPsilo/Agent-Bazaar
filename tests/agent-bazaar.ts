import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AgentBazaar } from "../target/types/agent_bazaar";
import { expect } from "chai";
import { PublicKey, SystemProgram } from "@solana/web3.js";

describe("agent_bazaar", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.agentBazaar as Program<AgentBazaar>;
  const authority = provider.wallet;

  let protocolStatePda: PublicKey;

  before(async () => {
    [protocolStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol")],
      program.programId
    );
  });

  it("Initializes the protocol", async () => {
    const tx = await program.methods
      .initialize(250)
      .accounts({
        protocolState: protocolStatePda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const state = await program.account.protocolState.fetch(protocolStatePda);
    expect(state.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(state.agentCount.toNumber()).to.equal(0);
    expect(state.platformFeeBps).to.equal(250);
    console.log("Protocol initialized. Tx:", tx);
  });

  it("Registers an agent", async () => {
    const agentId = new anchor.BN(0);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const tx = await program.methods
      .registerAgent(
        "Ziggy Alpha",
        "AI research agent monitoring 500+ Solana ecosystem X accounts",
        "https://agentbazaar.com/agents/1/registration.json",
        ["research", "alpha", "solana"]
      )
      .accounts({
        protocolState: protocolStatePda,
        agentIdentity: agentPda,
        agentReputation: repPda,
        owner: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const agent = await program.account.agentIdentity.fetch(agentPda);
    expect(agent.name).to.equal("Ziggy Alpha");
    expect(agent.active).to.be.true;
    expect(agent.agentId.toNumber()).to.equal(0);

    const state = await program.account.protocolState.fetch(protocolStatePda);
    expect(state.agentCount.toNumber()).to.equal(1);

    console.log("Agent registered. Tx:", tx);
  });

  it("Submits feedback and updates reputation", async () => {
    const agentId = new anchor.BN(0);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const timestamp = new anchor.BN(Math.floor(Date.now() / 1000) - 60); // Use timestamp 60 seconds in the past to avoid future timestamp error
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        agentId.toArrayLike(Buffer, "le", 8),
        authority.publicKey.toBuffer(),
        timestamp.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const commentHash = Array(32).fill(0);

    const tx = await program.methods
      .submitFeedback(
        agentId,
        5,
        commentHash,
        new anchor.BN(50000),
        timestamp
      )
      .accounts({
        protocolState: protocolStatePda,
        agentIdentity: agentPda,
        agentReputation: repPda,
        feedback: feedbackPda,
        rater: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const rep = await program.account.agentReputation.fetch(repPda);
    expect(rep.totalRatings.toNumber()).to.equal(1);
    expect(rep.ratingSum.toNumber()).to.equal(5);
    expect(rep.totalVolume.toNumber()).to.equal(50000);
    expect(rep.ratingDistribution[4].toNumber()).to.equal(1);

    const state = await program.account.protocolState.fetch(protocolStatePda);
    expect(state.totalTransactions.toNumber()).to.equal(1);
    expect(state.totalVolume.toNumber()).to.equal(50000);

    console.log("Feedback submitted. Tx:", tx);
    console.log("Reputation:", {
      totalRatings: rep.totalRatings.toNumber(),
      avgRating: rep.ratingSum.toNumber() / rep.totalRatings.toNumber(),
      totalVolume: rep.totalVolume.toNumber(),
    });
  });
});
