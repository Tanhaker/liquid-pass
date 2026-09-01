# Liquid Pass subgraph

Indexes the Liquid Pass contract on Arbitrum Sepolia.

**This is not a dependency of the marketplace.** The app reads chain state
directly with viem and works with no indexer at all; the subgraph adds
queryable history on top. If it is not deployed, nothing breaks.

## Deploy

Needs a Subgraph Studio deploy key from https://thegraph.com/studio.

```bash
cd subgraph
npm install
npx graph auth <DEPLOY_KEY>
npm run codegen
npm run build
npm run deploy
```

Then set the query URL Studio gives you:

```
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/<id>/liquid-pass/<version>
```

## Note on ERC-721

There is no `Transfer` handler. The contract deliberately does not implement
ERC-721 and emits `PassTransferred` instead, so indexing `Transfer` would be
indexing an event that never fires.
