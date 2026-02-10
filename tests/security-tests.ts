import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AgentBazaar } from "../target/types/agent_bazaar";
import { expect } from "chai";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";

describe("agent_bazaar security tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.agentBazaar as Program<AgentBazaar>;
  const authority = provider.wallet;

  let protocolStatePda: PublicKey;

  // Generate a separate keypair for attack scenarios
  const attacker = Keypair.generate();

  before(async () => {
    [protocolStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol")],
      program.programId
    );

    // Fund attacker wallet
    const sig = await provider.connection.requestAirdrop(
      attacker.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  });

  // =============================================
  // 1. AUTHORIZATION TESTS
  // =============================================

  it("SECURITY: Rejects double-initialization", async () => {
    try {
      await program.methods
        .initialize(250)
        .accounts({
          protocolState: protocolStatePda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have rejected double init");
    } catch (e: any) {
      // Account already initialized — Anchor rejects with custom(0) or 'already in use'
      expect(e.toString()).to.satisfy((s: string) =>
        s.includes("already in use") || s.includes("custom") || s.includes("0x0")
      );
    }
  });

  it("SECURITY: Non-authority cannot update_authority", async () => {
    try {
      await program.methods
        .updateAuthority(attacker.publicKey)
        .accounts({
          protocolState: protocolStatePda,
          authority: attacker.publicKey,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should have rejected non-authority");
    } catch (e: any) {
      expect(e.toString()).to.include("ConstraintHasOne");
    }
  });

  it("SECURITY: Non-authority cannot update_fee", async () => {
    try {
      await program.methods
        .updateFee(9999)
        .accounts({
          protocolState: protocolStatePda,
          authority: attacker.publicKey,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should have rejected non-authority");
    } catch (e: any) {
      expect(e.toString()).to.include("ConstraintHasOne");
    }
  });

  it("SECURITY: update_fee rejects > 10000 bps", async () => {
    try {
      await program.methods
        .updateFee(10001)
        .accounts({
          protocolState: protocolStatePda,
          authority: authority.publicKey,
        })
        .rpc();
      expect.fail("Should have rejected invalid fee");
    } catch (e: any) {
      expect(e.toString()).to.include("InvalidFee");
    }
  });

  // =============================================
  // 2. AGENT REGISTRATION ATTACKS
  // =============================================

  it("SECURITY: Rejects name > 64 chars", async () => {
    // Register a new agent with attacker as owner to get next agent_id
    const state = await program.account.protocolState.fetch(protocolStatePda);
    const agentId = state.agentCount;
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      await program.methods
        .registerAgent(
          "A".repeat(65),
          "desc",
          "https://example.com",
          ["test"]
        )
        .accounts({
          protocolState: protocolStatePda,
          agentIdentity: agentPda,
          agentReputation: repPda,
          owner: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject oversized name");
    } catch (e: any) {
      expect(e.toString()).to.include("NameTooLong");
    }
  });

  it("SECURITY: Rejects description > 256 chars", async () => {
    const state = await program.account.protocolState.fetch(protocolStatePda);
    const agentId = state.agentCount;
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      await program.methods
        .registerAgent(
          "Valid Name",
          "D".repeat(257),
          "https://example.com",
          ["test"]
        )
        .accounts({
          protocolState: protocolStatePda,
          agentIdentity: agentPda,
          agentReputation: repPda,
          owner: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject oversized description");
    } catch (e: any) {
      expect(e.toString()).to.include("DescriptionTooLong");
    }
  });

  it("SECURITY: Rejects > 5 categories", async () => {
    const state = await program.account.protocolState.fetch(protocolStatePda);
    const agentId = state.agentCount;
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      await program.methods
        .registerAgent(
          "Valid Name",
          "Valid desc",
          "https://example.com",
          ["a", "b", "c", "d", "e", "f"]
        )
        .accounts({
          protocolState: protocolStatePda,
          agentIdentity: agentPda,
          agentReputation: repPda,
          owner: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject too many categories");
    } catch (e: any) {
      expect(e.toString()).to.include("TooManyCategories");
    }
  });

  // =============================================
  // 3. ATTACKER REGISTERS AN AGENT (for later tests)
  // =============================================

  let attackerAgentId: anchor.BN;

  it("Attacker registers their own agent (setup for attack tests)", async () => {
    const state = await program.account.protocolState.fetch(protocolStatePda);
    attackerAgentId = state.agentCount;
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), attackerAgentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), attackerAgentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    await program.methods
      .registerAgent(
        "Attacker Agent",
        "For testing security",
        "https://evil.com",
        ["test"]
      )
      .accounts({
        protocolState: protocolStatePda,
        agentIdentity: agentPda,
        agentReputation: repPda,
        owner: attacker.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([attacker])
      .rpc();

    const agent = await program.account.agentIdentity.fetch(agentPda);
    expect(agent.name).to.equal("Attacker Agent");
    expect(agent.owner.toBase58()).to.equal(attacker.publicKey.toBase58());
  });

  // =============================================
  // 4. UPDATE/DEACTIVATE OWNERSHIP TESTS
  // =============================================

  it("SECURITY: Non-owner cannot update another's agent", async () => {
    // Authority (agent 0 owner) tries to update attacker's agent
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), attackerAgentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      await program.methods
        .updateAgent("Hijacked!", null, null)
        .accounts({
          agentIdentity: agentPda,
          owner: authority.publicKey,
        })
        .rpc();
      expect.fail("Should reject non-owner update");
    } catch (e: any) {
      expect(e.toString()).to.include("ConstraintHasOne");
    }
  });

  it("SECURITY: Non-owner cannot deactivate another's agent", async () => {
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), attackerAgentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      await program.methods
        .deactivateAgent()
        .accounts({
          agentIdentity: agentPda,
          owner: authority.publicKey,
        })
        .rpc();
      expect.fail("Should reject non-owner deactivate");
    } catch (e: any) {
      expect(e.toString()).to.include("ConstraintHasOne");
    }
  });

  // =============================================
  // 5. SELF-RATING ATTACK
  // =============================================

  it("SECURITY: Owner cannot rate their own agent (self-rating)", async () => {
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), attackerAgentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), attackerAgentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const timestamp = new anchor.BN(Math.floor(Date.now() / 1000) - 30);
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        attackerAgentId.toArrayLike(Buffer, "le", 8),
        attacker.publicKey.toBuffer(),
        timestamp.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitFeedback(
          attackerAgentId,
          5,
          Array(32).fill(0),
          new anchor.BN(100000),
          timestamp
        )
        .accounts({
          protocolState: protocolStatePda,
          agentIdentity: agentPda,
          agentReputation: repPda,
          feedback: feedbackPda,
          rater: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject self-rating");
    } catch (e: any) {
      expect(e.toString()).to.include("SelfRating");
    }
  });

  // =============================================
  // 6. FEEDBACK VALIDATION ATTACKS
  // =============================================

  it("SECURITY: Rejects rating of 0", async () => {
    const agentId = new anchor.BN(0); // authority's agent
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const timestamp = new anchor.BN(Math.floor(Date.now() / 1000) - 30);
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        agentId.toArrayLike(Buffer, "le", 8),
        attacker.publicKey.toBuffer(),
        timestamp.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitFeedback(
          agentId,
          0, // invalid
          Array(32).fill(0),
          new anchor.BN(1000),
          timestamp
        )
        .accounts({
          protocolState: protocolStatePda,
          agentIdentity: agentPda,
          agentReputation: repPda,
          feedback: feedbackPda,
          rater: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject rating 0");
    } catch (e: any) {
      expect(e.toString()).to.include("InvalidRating");
    }
  });

  it("SECURITY: Rejects rating of 6", async () => {
    const agentId = new anchor.BN(0);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const timestamp = new anchor.BN(Math.floor(Date.now() / 1000) - 30);
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        agentId.toArrayLike(Buffer, "le", 8),
        attacker.publicKey.toBuffer(),
        timestamp.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitFeedback(
          agentId,
          6, // invalid
          Array(32).fill(0),
          new anchor.BN(1000),
          timestamp
        )
        .accounts({
          protocolState: protocolStatePda,
          agentIdentity: agentPda,
          agentReputation: repPda,
          feedback: feedbackPda,
          rater: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject rating 6");
    } catch (e: any) {
      expect(e.toString()).to.include("InvalidRating");
    }
  });

  it("SECURITY: Rejects amount_paid = 0", async () => {
    const agentId = new anchor.BN(0);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const timestamp = new anchor.BN(Math.floor(Date.now() / 1000) - 25);
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        agentId.toArrayLike(Buffer, "le", 8),
        attacker.publicKey.toBuffer(),
        timestamp.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitFeedback(
          agentId,
          4,
          Array(32).fill(0),
          new anchor.BN(0), // invalid
          timestamp
        )
        .accounts({
          protocolState: protocolStatePda,
          agentIdentity: agentPda,
          agentReputation: repPda,
          feedback: feedbackPda,
          rater: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject zero amount");
    } catch (e: any) {
      expect(e.toString()).to.include("InvalidAmount");
    }
  });

  it("SECURITY: Rejects amount_paid > 1B (volume inflation cap)", async () => {
    const agentId = new anchor.BN(0);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const timestamp = new anchor.BN(Math.floor(Date.now() / 1000) - 20);
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        agentId.toArrayLike(Buffer, "le", 8),
        attacker.publicKey.toBuffer(),
        timestamp.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitFeedback(
          agentId,
          5,
          Array(32).fill(0),
          new anchor.BN("1000000001"), // 1B + 1 — exceeds cap
          timestamp
        )
        .accounts({
          protocolState: protocolStatePda,
          agentIdentity: agentPda,
          agentReputation: repPda,
          feedback: feedbackPda,
          rater: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject amount > 1B");
    } catch (e: any) {
      expect(e.toString()).to.include("AmountTooLarge");
    }
  });

  it("SECURITY: Rejects future timestamp", async () => {
    const agentId = new anchor.BN(0);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const futureTs = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1h in future
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        agentId.toArrayLike(Buffer, "le", 8),
        attacker.publicKey.toBuffer(),
        futureTs.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitFeedback(
          agentId,
          4,
          Array(32).fill(0),
          new anchor.BN(5000),
          futureTs
        )
        .accounts({
          protocolState: protocolStatePda,
          agentIdentity: agentPda,
          agentReputation: repPda,
          feedback: feedbackPda,
          rater: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject future timestamp");
    } catch (e: any) {
      expect(e.toString()).to.include("FutureTimestamp");
    }
  });

  it("SECURITY: Rejects timestamp > 24h old", async () => {
    const agentId = new anchor.BN(0);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const oldTs = new anchor.BN(Math.floor(Date.now() / 1000) - 90000); // 25h ago
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        agentId.toArrayLike(Buffer, "le", 8),
        attacker.publicKey.toBuffer(),
        oldTs.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitFeedback(
          agentId,
          3,
          Array(32).fill(0),
          new anchor.BN(1000),
          oldTs
        )
        .accounts({
          protocolState: protocolStatePda,
          agentIdentity: agentPda,
          agentReputation: repPda,
          feedback: feedbackPda,
          rater: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject old timestamp");
    } catch (e: any) {
      expect(e.toString()).to.include("TimestampTooOld");
    }
  });

  // =============================================
  // 7. DEACTIVATED AGENT TESTS
  // =============================================

  it("SECURITY: Cannot submit feedback on deactivated agent", async () => {
    // First deactivate attacker's agent
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), attackerAgentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    await program.methods
      .deactivateAgent()
      .accounts({
        agentIdentity: agentPda,
        owner: attacker.publicKey,
      })
      .signers([attacker])
      .rpc();

    // Now try to rate the deactivated agent
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), attackerAgentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const timestamp = new anchor.BN(Math.floor(Date.now() / 1000) - 10);
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        attackerAgentId.toArrayLike(Buffer, "le", 8),
        authority.publicKey.toBuffer(),
        timestamp.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitFeedback(
          attackerAgentId,
          1,
          Array(32).fill(0),
          new anchor.BN(1000),
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
      expect.fail("Should reject feedback on inactive agent");
    } catch (e: any) {
      expect(e.toString()).to.include("InvalidAgent");
    }
  });

  it("SECURITY: Rejects reactivate on already-active agent", async () => {
    // Reactivate first
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), attackerAgentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    await program.methods
      .reactivateAgent()
      .accounts({
        agentIdentity: agentPda,
        owner: attacker.publicKey,
      })
      .signers([attacker])
      .rpc();

    // Try to reactivate again
    try {
      await program.methods
        .reactivateAgent()
        .accounts({
          agentIdentity: agentPda,
          owner: attacker.publicKey,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject reactivate on active agent");
    } catch (e: any) {
      expect(e.toString()).to.include("AgentAlreadyActive");
    }
  });

  // =============================================
  // 8. VALID CROSS-AGENT FEEDBACK (positive test)
  // =============================================

  let validFeedbackTimestamp: anchor.BN;

  it("Valid feedback: attacker rates authority's agent", async () => {
    const agentId = new anchor.BN(0);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const timestamp = new anchor.BN(Math.floor(Date.now() / 1000) - 15);
    validFeedbackTimestamp = timestamp;
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        agentId.toArrayLike(Buffer, "le", 8),
        attacker.publicKey.toBuffer(),
        timestamp.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const tx = await program.methods
      .submitFeedback(
        agentId,
        4,
        Array(32).fill(1), // non-zero comment hash
        new anchor.BN(25000),
        timestamp
      )
      .accounts({
        protocolState: protocolStatePda,
        agentIdentity: agentPda,
        agentReputation: repPda,
        feedback: feedbackPda,
        rater: attacker.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([attacker])
      .rpc();

    // Verify reputation was updated (don't assert exact values since other tests may have run)
    const rep = await program.account.agentReputation.fetch(repPda);
    expect(rep.totalRatings.toNumber()).to.be.greaterThan(0);
    expect(rep.ratingSum.toNumber()).to.be.greaterThan(0);
    expect(rep.totalVolume.toNumber()).to.be.greaterThan(0);

    // Verify protocol stats incremented
    const state = await program.account.protocolState.fetch(protocolStatePda);
    expect(state.totalTransactions.toNumber()).to.be.greaterThan(0);

    console.log("Cross-agent feedback verified. Tx:", tx);
    console.log("Avg rating:", rep.ratingSum.toNumber() / rep.totalRatings.toNumber());
  });

  // =============================================
  // 9. DUPLICATE FEEDBACK (same rater, same timestamp — should fail)
  // =============================================

  it("SECURITY: Duplicate feedback PDA rejected (same rater+timestamp)", async () => {
    const agentId = new anchor.BN(0);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [repPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), agentId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    // Use same timestamp as valid feedback test — PDA already exists
    const timestamp = validFeedbackTimestamp;
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        agentId.toArrayLike(Buffer, "le", 8),
        attacker.publicKey.toBuffer(),
        timestamp.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitFeedback(
          agentId,
          1,
          Array(32).fill(0),
          new anchor.BN(1000),
          timestamp
        )
        .accounts({
          protocolState: protocolStatePda,
          agentIdentity: agentPda,
          agentReputation: repPda,
          feedback: feedbackPda,
          rater: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("Should reject duplicate feedback PDA");
    } catch (e: any) {
      // PDA already initialized
      expect(e.toString()).to.satisfy((s: string) =>
        s.includes("already in use") || s.includes("custom") || s.includes("0x0")
      );
    }
  });

  // =============================================
  // 10. PROTOCOL STATE INTEGRITY CHECK
  // =============================================

  it("Verify final protocol state integrity", async () => {
    const state = await program.account.protocolState.fetch(protocolStatePda);
    
    console.log("\n=== PROTOCOL STATE ===");
    console.log("Authority:", state.authority.toBase58());
    console.log("Agent count:", state.agentCount.toNumber());
    console.log("Platform fee:", state.platformFeeBps, "bps");
    console.log("Total transactions:", state.totalTransactions.toNumber());
    console.log("Total volume:", state.totalVolume.toNumber());
    
    expect(state.agentCount.toNumber()).to.be.greaterThanOrEqual(2); // at least authority's + attacker's
    expect(state.totalTransactions.toNumber()).to.be.greaterThanOrEqual(1);
    expect(state.platformFeeBps).to.equal(250);
    
    // Check both agents
    for (let i = 0; i < 2; i++) {
      const id = new anchor.BN(i);
      const [agentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), id.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      const [repPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reputation"), id.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      
      const agent = await program.account.agentIdentity.fetch(agentPda);
      const rep = await program.account.agentReputation.fetch(repPda);
      
      console.log(`\n--- Agent ${i}: ${agent.name} ---`);
      console.log("Owner:", agent.owner.toBase58());
      console.log("Active:", agent.active);
      console.log("Ratings:", rep.totalRatings.toNumber());
      console.log("Avg:", rep.totalRatings.toNumber() > 0 
        ? (rep.ratingSum.toNumber() / rep.totalRatings.toNumber()).toFixed(1) 
        : "N/A");
      console.log("Volume:", rep.totalVolume.toNumber());
      console.log("Distribution:", rep.ratingDistribution.map((d: any) => d.toNumber()));
    }
  });
});
