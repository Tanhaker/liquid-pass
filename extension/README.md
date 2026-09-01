# Liquid Pass — Chrome extension

A read-only companion. It shows the passes an address owns and how much time
each has left, and links into the marketplace.

**It is deliberately not a transaction path.** It holds no keys and cannot
sign; buying, listing and reselling all happen on the website with your normal
wallet. An extension that could move assets would need a security review this
project has not had.

## Install

1. `chrome://extensions`
2. Enable Developer mode
3. "Load unpacked" and select this `extension/` folder

Paste any address to watch it — it is stored locally in the extension only.

## How it reads the chain

Direct JSON-RPC `eth_call` against the public Arbitrum Sepolia endpoint. No
wagmi, no bundler, no build step: `popup.js` is plain ES module JavaScript, so
what you load is what you read.
