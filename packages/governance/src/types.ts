// ── Realms / SPL Governance types ────────────────────────────────────────────

export type ProposalState =
  | 'Draft'
  | 'SigningOff'
  | 'Voting'
  | 'Succeeded'
  | 'Executing'
  | 'Completed'
  | 'Cancelled'
  | 'Defeated'
  | 'ExecutingWithErrors'
  | 'Vetoed'

export type VoteType = 'SingleChoice' | 'MultiChoice'
export type VoteSide  = 'Yes' | 'No' | 'Abstain' | 'Veto'

export interface Realm {
  /** Realm PDA address */
  address:          string
  name:             string
  /** Community mint (governance token) */
  communityMint:    string
  /** Council mint (optional) */
  councilMint?:     string
  /** Min tokens to create a proposal */
  minCommunityTokensToCreateGovernance: string
  votingProposalCount: number
  /** Off-chain metadata */
  iconUrl?:         string
  bannerUrl?:       string
  description?:     string
  website?:         string
  twitter?:         string
  discord?:         string
}

export interface GovernanceProposal {
  address:          string
  realmAddress:     string
  governanceAddress: string
  name:             string
  description?:     string
  descriptionLink?: string    // IPFS / Arweave link to full proposal
  state:            ProposalState
  voteType:         VoteType
  /** Unix timestamp */
  draftAt:          number
  signingOffAt?:    number
  votingAt?:        number
  votingCompletedAt?: number
  executingAt?:     number
  closedAt?:        number
  yesVoteCount:     string   // bigint as string
  noVoteCount:      string
  abstainVoteCount?: string
  options?:         Array<{ label: string; voteWeight: string }>
  proposalOwner:    string
  vetoVoteWeight?:  string
  maxVoteWeight?:   string
  executionFlags:   number
  maxVotingTime:    number   // seconds
  startVotingAt?:   number
}

export interface VoteRecord {
  proposalAddress:   string
  governingTokenOwner: string
  isRelinquished:    boolean
  voterWeight:       string
  vote:              {
    voteType: VoteSide
    approveChoices?: Array<{ rank: number; weightPercentage: number }>
  }
}

export interface TokenOwnerRecord {
  realmAddress:              string
  governingTokenMint:        string
  governingTokenOwner:       string
  governingTokenDepositAmount: string
  unrelinquishedVotesCount:  number
  totalVotesCount:           number
  outstandingProposalCount:  number
}

export interface RealmMember {
  walletAddress:    string
  communityWeight:  string   // voting power from community tokens
  councilWeight?:   string   // voting power from council tokens
  activeProposals:  number
  totalVotes:       number
}

// ── Clutch governance integration ─────────────────────────────────────────────

export interface WatchedRealm {
  realmAddress:     string
  realm:            Realm
  userRecord?:      TokenOwnerRecord
  activeProposals:  GovernanceProposal[]
  addedAt:          Date
}

export interface VotingPower {
  realmAddress:    string
  communityPower:  string
  councilPower?:   string
  canVote:         boolean
  canCreateProposal: boolean
}
