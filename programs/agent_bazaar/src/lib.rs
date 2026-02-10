use anchor_lang::prelude::*;

declare_id!("4sNnsVkYeYHGZiM7YjTtisSyBMQnGiecUdjwx2c9wcAb");

pub const MAX_NAME_LEN: usize = 64;
pub const MAX_DESC_LEN: usize = 256;
pub const MAX_URI_LEN: usize = 256;
pub const MAX_CATEGORIES: usize = 5;
pub const MAX_CATEGORY_LEN: usize = 32;

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

    pub fn submit_feedback(
        ctx: Context<SubmitFeedback>,
        agent_id: u64,
        rating: u8,
        comment_hash: [u8; 32],
        amount_paid: u64,
        timestamp: i64,
    ) -> Result<()> {
        require!(rating >= 1 && rating <= 5, ErrorCode::InvalidRating);

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
        rep.total_ratings += 1;
        rep.rating_sum += rating as u64;
        rep.total_volume += amount_paid;
        rep.rating_distribution[(rating - 1) as usize] += 1;
        rep.last_rated_at = timestamp;
        // simplified: not tracking unique_raters on-chain for hackathon
        rep.unique_raters += 1;

        let state = &mut ctx.accounts.protocol_state;
        state.total_transactions += 1;
        state.total_volume += amount_paid;

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
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        has_one = owner,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,
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
    )]
    pub agent_identity: Account<'info, AgentIdentity>,
    #[account(
        mut,
        seeds = [b"reputation", agent_id.to_le_bytes().as_ref()],
        bump = agent_reputation.bump,
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
}
