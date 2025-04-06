# LinguaBridge

LinguaBridge is a decentralized translation enhancement system that combines ElizaOS multi-agent framework with 0g blockchain protocol to provide professional translation services. It addresses the challenges of rare language translation, specialized domain terminology, and cultural context understanding.

## Overview

Traditional translation services and AI models face significant limitations:

- Lack of data for rare languages (e.g., Swahili, Hausa)
- Inability to adapt to specialized professional contexts
- Limited understanding of cultural nuances, idioms, and dialects

LinguaBridge solves these problems through:

- Incentivized corpus contribution with token rewards
- AI agent-based content review
- RAG (Retrieval-Augmented Generation) enhanced translation
- Blockchain-based ownership and value attribution

## Key Features

- **Decentralized Corpus Collection**: Community members can contribute specialized knowledge and receive token rewards
- **Dynamic RAG Enhancement**: Improves translation quality with domain-specific knowledge
- **Blockchain Incentives**: ERC20 token rewards based on contribution quality
- **Cultural Context Integration**: Supports uploading cultural knowledge to make translations more authentic

## Technical Architecture

LinguaBridge is built on a multi-layered architecture:

- **Blockchain Layer**: Solidity contracts on 0G protocol for metadata management
- **Storage Layer**: Distributed file storage via 0G and IPFS
- **Incentive Layer**: ERC20 token rewards based on contribution quality
- **Application Layer**: RAG service with DeepSeek API and FAISS for knowledge retrieval

## Getting Started

### Deploy Smart Contracts

Configure the environment variables in .env file:

```bash
ZEROG_PRIVATE_KEY=0x01xxxx
```

```bash
git clone https://github.com/redstone-network/LinguaBridge-contract
yarn install
yarn deploy:zerog
```

### Run LinguaBridge Backend

Configure the environment variables in .env file:

```bash
ZEROG_INDEXER_RPC_URL=https://indexer-storage-testnet-turbo.0g.ai
ZEROG_RPC_URL=https://evmrpc-testnet.0g.ai
ZEROG_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai
ZEROG_EVM_RPC=https://evmrpc-testnet.0g.ai
ZEROG_PRIVATE_KEY=0x01xxx
ZEROG_FLOW_ADDRESS=0xbD2C3F0E65eDF5582141C35969d66e34629cC768
INDUSTRY_KNOWLEDGE_CONTRACT=0xA1C6E3B636B2BBD007bcDBe53a0d3a0641C78bAB
```

Then install dependencies and start the backend:

```bash
pnpm install
pnpm build && pnpm start --characters="characters/sanzang.character.json, characters/zerog.character.json"
```

### Run Client Application

```bash
pnpm install
pnpm start:client
```

## Core Workflows

1. Corpus Contribution :

    - Upload industry knowledge documents (PDF/Word/TXT)
    - System calculates file hash and stores metadata on-chain
    - File content is stored in 0G storage layer

2. Review Process :

    - ai agent Reviewers approve content through batch operations

3. Translation Enhancement :
    - User submits translation request
    - System retrieves relevant knowledge from the corpus
    - RAG engine enhances translation with domain-specific context
    - User receives culturally-aware, domain-specific translation

## Innovation Highlights

- Dynamic Quality Assessment : Reward coefficient based on semantic density, user ratings, and usage frequency
- Sybil Attack Resistance : Contributor credit system with ZK-proof requirements for low-trust users
- Optimized RAG Strategy : Balanced approach combining semantic (60%), keyword (30%), and recency-based (10%) retrieval

## Performance Targets

- File upload latency: <2s
- Review transaction throughput: ≥50 TPS
- RAG retrieval accuracy: >92% (BLEU score)
- Token reward success rate: 99.99%

## Future Extensions

- Multi-language support through category-based knowledge organization
- DAO governance for reviewer elections and reward parameter voting
- Corpus deprecation mechanisms to maintain knowledge freshness

## License

MIT License
