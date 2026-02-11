use anchor_lang::prelude::*;

declare_id!("4sNnsVkYeYHGZiM7YjTtisSyBMQnGiecUdjwx2c9wcAb");

pub const MAX_NAME_LEN: usize = 64;
pub const MAX_DESC_LEN: usize = 256;
pub const MAX_URI_LEN: usize = 256;
pub const MAX_CATEGORIES: usize = 5;
pub const MAX_CATEGORY_LEN: usize = 32;
pub const MIN_NAME_LEN: usize = 3;
pub const MIN_FEEDBACK_INTERVAL: i64 = 3600; // 1 hour between reviews from same rater per agent

#[program]
pub mod agent_bazaar {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, platform_fee_bps: u16) -> Result<()> {
        require!(platform_fee_bps <= 10000, ErrorCode::InvalidFee);
        let state = &mut ctx.accounts.protocol_state;
        state.authority = ctx.accounts.authority.key();
        state.agent_count = 0;
        state.platform_fee_bps = platform_fee_bps;
        state.fee_vault = ctx.accounts.authority.key();
        state.total_transactions = 0;
        state.total_volume = 0;
        state.bump = ctx.bumps.protocol_state;
        Ok(())
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        description: String,
        agent_uri: String,
        categories: Vec<String>,
    ) -> Result<()> {
        require!(name.len() >= MIN_NAME_LEN, ErrorCode::NameTooShort);
        require!(name.len() <= MAX_NAME_LEN, ErrorCode::NameTooLong);
        require!(description.len() <= MAX_DESC_LEN, ErrorCode::DescriptionTooLong);
        require!(agent_uri.len() <= MAX_URI_LEN, ErrorCode::UriTooLong);
        require!(categories.len() <= MAX_CATEGORIES, ErrorCode::TooManyCategories);
        for cat in &categories {
            require!(cat.len() <= MAX_CATEGORY_LEN, ErrorCode::CategoryTooLong);
        }

        let state = &mut ctx.accounts.protocol_state;
        let agent_id = state.agent_count;
        state.agent_count += 1;

        let clock = Clock::get()?;
        let agent = &mut ctx.accounts.agent_identity;
        agent.agent_id = agent_id;
        agent.owner = ctx.accounts.owner.key();
        agent.agent_wallet = ctx.accounts.owner.key();
        agent.name = name;
        agent.description = description;
        agent.agent_uri = agent_uri;
        agent.active = true;
        agent.registered_at = clock.unix_timestamp;
        agent.updated_at = clock.unix_timestamp;
        agent.bump = ctx.bumps.agent_identity;

        let rep = &mut ctx.accounts.agent_reputation;
        rep.agent_id = agent_id;
        rep.total_ratings = 0;
        rep.rating_sum = 0;
        rep.total_volume = 0;
        rep.unique_raters = 0;
        rep.rating_distribution = [0; 5];
        rep.last_rated_at = 0;
        rep.bump = ctx.bumps.agent_reputation;

        emit!(AgentRegistered {
            agent_id,
            owner: ctx.accounts.owner.key(),
            name: agent.name.clone(),
        });

        Ok(())
    }

    pub fn update_agent(
        ctx: Context<UpdateAgent>,
        name: Option<String>,
        description: Option<String>,
        agent_uri: Option<String>,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent_identity;
        if let Some(n) = name {
            require!(n.len() <= MAX_NAME_LEN, ErrorCode::NameTooLong);
            agent.name = n;
        }
        if let Some(d) = description {
            require!(d.len() <= MAX_DESC_LEN, ErrorCode::DescriptionTooLong);
            agent.description = d;
        }
        if let Some(u) = agent_uri {
            require!(u.len() <= MAX_URI_LEN, ErrorCode::UriTooLong);
            agent.agent_uri = u;
        }
        agent.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn deactivate_agent(ctx: Context<UpdateAgent>) -> Result<()> {
        let agent = &mut ctx.accounts.agent_identity;
        agent.active = false;
        agent.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Reactivate a previously deactivated agent. Only owner can call.
    pub fn reactivate_agent(ctx: Context<UpdateAgent>) -> Result<()> {
        let agent = &mut ctx.accounts.agent_identity;
        require!(!agent.active, ErrorCode::AgentAlreadyActive);
        agent.active = true;
        agent.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn close_agent(ctx: Context<CloseAgent>) -> Result<()> {
        require!(!ctx.accounts.agent_identity.active, ErrorCode::AgentStillActive);
        
        // Additional safety: ensure no recent feedback to prevent abuse
        let clock = Clock::get()?;
        require!(
            ctx.accounts.agent_reputation.last_rated_at == 0 ||
            ctx.accounts.agent_reputation.last_rated_at < clock.unix_timestamp - 86400 * 7, // 7 days
            ErrorCode::RecentActivity
        );

        Ok(())
    }

    /// Update protocol authority (governance). Only current authority can call.
    pub fn update_authority(ctx: Context<UpdateAuthority>, new_authority: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.protocol_state;
        state.authority = new_authority;
        Ok(())
    }

    /// Update platform fee. Only authority can call.
    pub fn update_fee(ctx: Context<UpdateAuthority>, new_fee_bps: u16) -> Result<()> {
        require!(new_fee_bps <= 10000, ErrorCode::InvalidFee);
        let state = &mut ctx.accounts.protocol_state;
        state.platform_fee_bps = new_fee_bps;
        Ok(())
    }

    pub fn submit_feedback(
        ctx: Context<SubmitFeedback>,
        agent_id: u64,
        rating: u8,
        comment_hash: [u8; 32],
        amount_paid: u64,
        timestamp: i64,
    ) -> Result<()> {
        require!(rating >= 1 && rating <= 5, ErrorCode::InvalidRating);
        require!(amount_paid > 0, ErrorCode::InvalidAmount);
        require!(timestamp > 0, ErrorCode::InvalidTimestamp);

        // SECURITY: Prevent self-rating on-chain
        require!(
            ctx.accounts.rater.key() != ctx.accounts.agent_identity.owner,
            ErrorCode::SelfRating
        );

        let clock = Clock::get()?;
        require!(
            timestamp <= clock.unix_timestamp,
            ErrorCode::FutureTimestamp
        );
        require!(
            timestamp >= clock.unix_timestamp - 86400, // Max 24h old
            ErrorCode::TimestampTooOld
        );

        // SECURITY: Enforce per-rater cooldown to prevent sybil spam from same wallet
        let rater_state = &mut ctx.accounts.rater_state;
        if rater_state.last_feedback_at > 0 {
            require!(
                clock.unix_timestamp - rater_state.last_feedback_at >= MIN_FEEDBACK_INTERVAL,
                ErrorCode::FeedbackTooFrequent
            );
        }
        rater_state.rater = ctx.accounts.rater.key();
        rater_state.agent_id = agent_id;
        rater_state.last_feedback_at = clock.unix_timestamp;
        rater_state.feedback_count = rater_state.feedback_count.checked_add(1)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        rater_state.bump = ctx.bumps.rater_state;

        let feedback = &mut ctx.accounts.feedback;
        feedback.agent_id = agent_id;
        feedback.rater = ctx.accounts.rater.key();
        feedback.rating = rating;
        feedback.comment_hash = comment_hash;
        feedback.tx_signature = [0u8; 64]; // simplified for hackathon
        feedback.amount_paid = amount_paid;
        feedback.created_at = timestamp;
        feedback.bump = ctx.bumps.feedback;

        let rep = &mut ctx.accounts.agent_reputation;
        rep.total_ratings = rep.total_ratings.checked_add(1)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        rep.rating_sum = rep.rating_sum.checked_add(rating as u64)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        rep.total_volume = rep.total_volume.checked_add(amount_paid)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        rep.rating_distribution[(rating - 1) as usize] = rep.rating_distribution[(rating - 1) as usize]
            .checked_add(1).ok_or(ErrorCode::ArithmeticOverflow)?;
        rep.last_rated_at = timestamp;
        // SECURITY: Only increment unique_raters on first feedback from this rater
        // (rater_state.feedback_count was already incremented above, so ==1 means first time)
        if rater_state.feedback_count == 1 {
            rep.unique_raters = rep.unique_raters.checked_add(1)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        }

        let state = &mut ctx.accounts.protocol_state;
        state.total_transactions = state.total_transactions.checked_add(1)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        state.total_volume = state.total_volume.checked_add(amount_paid)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        emit!(FeedbackSubmitted {
            agent_id,
            rater: ctx.accounts.rater.key(),
            rating,
            amount_paid,
        });

        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolState::INIT_SPACE,
        seeds = [b"protocol"],
        bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump,
        constraint = protocol_state.agent_count < u64::MAX @ ErrorCode::TooManyAgents,
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        init,
        payer = owner,
        space = 8 + AgentIdentity::INIT_SPACE,
        seeds = [b"agent", protocol_state.agent_count.to_le_bytes().as_ref()],
        bump
    )]
    pub agent_identity: Account<'info, AgentIdentity>,
    #[account(
        init,
        payer = owner,
        space = 8 + AgentReputation::INIT_SPACE,
        seeds = [b"reputation", protocol_state.agent_count.to_le_bytes().as_ref()],
        bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump,
        has_one = authority,
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        has_one = owner,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseAgent<'info> {
    #[account(
        mut,
        has_one = owner,
        close = owner,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,
    #[account(
        mut,
        constraint = agent_reputation.agent_id == agent_identity.agent_id,
        close = owner,
    )]
    pub agent_reputation: Account<'info, AgentReputation>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(agent_id: u64, rating: u8, comment_hash: [u8; 32], amount_paid: u64, timestamp: i64)]
pub struct SubmitFeedback<'info> {
    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_state.bump,
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        seeds = [b"agent", agent_id.to_le_bytes().as_ref()],
        bump = agent_identity.bump,
        constraint = agent_identity.active @ ErrorCode::InvalidAgent,
        constraint = agent_identity.agent_id == agent_id @ ErrorCode::InvalidAgent,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,
    #[account(
        mut,
        seeds = [b"reputation", agent_id.to_le_bytes().as_ref()],
        bump = agent_reputation.bump,
        constraint = agent_reputation.agent_id == agent_id @ ErrorCode::InvalidAgent,
    )]
    pub agent_reputation: Account<'info, AgentReputation>,
    #[account(
        init,
        payer = rater,
        space = 8 + Feedback::INIT_SPACE,
        seeds = [
            b"feedback",
            agent_id.to_le_bytes().as_ref(),
            rater.key().as_ref(),
            timestamp.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub feedback: Account<'info, Feedback>,
    #[account(
        init_if_needed,
        payer = rater,
        space = 8 + RaterState::INIT_SPACE,
        seeds = [
            b"rater_state",
            agent_id.to_le_bytes().as_ref(),
            rater.key().as_ref(),
        ],
        bump
    )]
    pub rater_state: Account<'info, RaterState>,
    #[account(mut)]
    pub rater: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct ProtocolState {
    pub authority: Pubkey,
    pub agent_count: u64,
    pub platform_fee_bps: u16,
    pub fee_vault: Pubkey,
    pub total_transactions: u64,
    pub total_volume: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AgentIdentity {
    pub agent_id: u64,
    pub owner: Pubkey,
    pub agent_wallet: Pubkey,
    #[max_len(64)]
    pub name: String,
    #[max_len(256)]
    pub description: String,
    #[max_len(256)]
    pub agent_uri: String,
    pub active: bool,
    pub registered_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AgentReputation {
    pub agent_id: u64,
    pub total_ratings: u64,
    pub rating_sum: u64,
    pub total_volume: u64,
    pub unique_raters: u64,
    pub rating_distribution: [u64; 5],
    pub last_rated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RaterState {
    pub rater: Pubkey,
    pub agent_id: u64,
    pub last_feedback_at: i64,
    pub feedback_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Feedback {
    pub agent_id: u64,
    pub rater: Pubkey,
    pub rating: u8,
    pub comment_hash: [u8; 32],
    pub tx_signature: [u8; 64],
    pub amount_paid: u64,
    pub created_at: i64,
    pub bump: u8,
}

// === Events ===

#[event]
pub struct AgentRegistered {
    pub agent_id: u64,
    pub owner: Pubkey,
    pub name: String,
}

#[event]
pub struct FeedbackSubmitted {
    pub agent_id: u64,
    pub rater: Pubkey,
    pub rating: u8,
    pub amount_paid: u64,
}

// === Errors ===

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid fee: must be <= 10000 bps")]
    InvalidFee,
    #[msg("Name too long: max 64 chars")]
    NameTooLong,
    #[msg("Description too long: max 256 chars")]
    DescriptionTooLong,
    #[msg("URI too long: max 256 chars")]
    UriTooLong,
    #[msg("Too many categories: max 5")]
    TooManyCategories,
    #[msg("Category too long: max 32 chars")]
    CategoryTooLong,
    #[msg("Invalid rating: must be 1-5")]
    InvalidRating,
    #[msg("Invalid amount: must be > 0")]
    InvalidAmount,
    #[msg("Invalid timestamp: must be > 0")]
    InvalidTimestamp,
    #[msg("Timestamp cannot be in the future")]
    FutureTimestamp,
    #[msg("Timestamp too old: max 24h")]
    TimestampTooOld,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Invalid agent: agent not found or inactive")]
    InvalidAgent,
    #[msg("Too many agents: registration limit reached")]
    TooManyAgents,
    #[msg("Agent still active: cannot close")]
    AgentStillActive,
    #[msg("Recent activity: cannot close within 7 days of last feedback")]
    RecentActivity,
    #[msg("Agent is already active")]
    AgentAlreadyActive,
    #[msg("Cannot rate your own agent")]
    SelfRating,
    #[msg("Name too short: min 3 chars")]
    NameTooShort,
    #[msg("Feedback too frequent: wait at least 1 hour between reviews for the same agent")]
    FeedbackTooFrequent,
}
