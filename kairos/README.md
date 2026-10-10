# Kairos

**Dutch auctions that reprice every Monad block.**  
Clearing price is a pure function of `block.number`. No oracle. No keeper. First payer wins.

Built for **Monad Blitz Pune V3**.

## Why Monad

On a 12-second chain the price barely moves during a 3-minute demo. On Monad the floor is visible in real time — that is the product.

## Links (fill these after you ship)

| Item | Value |
|------|--------|
| **Live page** | `kairos.ing.ng` |
| **Contract (Monad Testnet)** | `0xCa5e28BD31295C541B5816e055f3ee3b417867b3` |
| **Explorer** | `https://testnet.monadexplorer.com/address/0xCa5e28BD31295C541B5816e055f3ee3b417867b3` |
| **Chain ID** | `10143` |



## Pitch checklist (say out loud)

1. Public GitHub repo (this repo)
2. README with live public page + contract address
3. Smart contracts deployed on Monad Testnet
4. Project publicly hosted

## Demo script (~3 min)

1. Open the live page — show **block number** ticking (Monad Testnet).
2. Point at a listing — **price is falling**.
3. Connect wallet → **Snap at this block** → confirm `buy()` on-chain.
4. Show explorer tx + 2% fee story (revenue).
5. Optional: list a new drop live.

## Contract

`contracts/Kairos.sol`

| Function | What it does |
|----------|----------------|
| `create(title, startPrice, floorPrice, durationBlocks)` | Open a Dutch auction from the current block |
| `price(id)` | Live price from `block.number` |
| `buy(id)` | Pay current price; 2% fee; seller paid; excess refunded |
| `withdrawFees()` | Owner pulls accrued fees |
| `getAuction(id)` | Full auction + live price |

Fee: **200 bps (2%)**.

### Deploy (Foundry)

```bash
# one-time
curl -L https://foundry.paradigm.xyz | bash && foundryup

export PRIVATE_KEY=0xYOUR_KEY          # funded with testnet MON
export RPC=https://testnet-rpc.monad.xyz

forge build
forge test
forge script script/Deploy.s.sol \
  --rpc-url $RPC \
  --broadcast \
  --private-key $PRIVATE_KEY
```

Copy the printed address into:

1. `frontend/config.js` → `CONTRACT_ADDRESS`
2. This README table above

### Verify (Sourcify / Monad explorer)

```bash
forge verify-contract <ADDRESS> contracts/Kairos.sol:Kairos \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```

Get testnet MON from the official Monad faucet if needed.

## Frontend

Static site in `frontend/` (no build step).

```bash
cd frontend
# after setting CONTRACT_ADDRESS in config.js
python3 -m http.server 8080
# or deploy the frontend/ folder to Vercel / Netlify / Cloudflare Pages / GitHub Pages
```

- **Demo mode**: empty `CONTRACT_ADDRESS` → local listings, still tracks real Monad block when RPC is reachable.
- **On-chain mode**: set address → `create` / `buy` hit the contract.

Wallet must be on **Monad Testnet (10143)**. The UI offers to add/switch the chain.

## Run from README (judges)

1. Clone repo
2. `forge build && forge test`
3. Deploy or use the address in the table
4. Open the live URL, connect wallet, list or snap

## Repo layout

```
contracts/Kairos.sol    # core contract
contracts/Kairos.t.sol  # tests
script/Deploy.s.sol     # deploy script
frontend/               # static UI
foundry.toml
README.md
```

## Build in public (suggested posts)

Tag `@monad` `@monad_dev` `@geeky_kartikey`

- Announcement: idea + why block-timed Dutch auctions need Monad  
- Demo video ≥30s: price falling + live `buy()`  
- Short product ad  
- Track combined views by **5:45 PM IST** submission deadline  

## License

MIT
