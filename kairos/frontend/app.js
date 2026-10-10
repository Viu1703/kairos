import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  formatEther,
  defineChain,
} from "https://esm.sh/viem@2.21.54";
import {
  CONTRACT_ADDRESS,
  CHAIN_ID,
  RPC_URL,
  EXPLORER,
  FEE_BPS,
} from "./config.js";

const ABI = [
  {
    type: "function",
    name: "create",
    stateMutability: "nonpayable",
    inputs: [
      { name: "title", type: "string" },
      { name: "startPrice", type: "uint96" },
      { name: "floorPrice", type: "uint96" },
      { name: "durationBlocks", type: "uint64" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "price",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "count",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getAuction",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "a",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "title", type: "string" },
          { name: "startPrice", type: "uint96" },
          { name: "floorPrice", type: "uint96" },
          { name: "startBlock", type: "uint64" },
          { name: "endBlock", type: "uint64" },
          { name: "buyer", type: "address" },
        ],
      },
      { name: "livePrice", type: "uint256" },
    ],
  },
];


const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "MonadExplorer", url: EXPLORER } },
});

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(RPC_URL),
});

const ZERO = "0x0000000000000000000000000000000000000000";
const hasContract = Boolean(CONTRACT_ADDRESS && CONTRACT_ADDRESS.startsWith("0x") && CONTRACT_ADDRESS.length === 42);

let account = null;
let walletClient = null;
let blockNumber = 0n;
let demoAuctions = [];
let tape = [];

const $ = (id) => document.getElementById(id);

function flash(msg) {
  const el = $("flash");
  el.style.display = "block";
  el.textContent = msg;
}

function short(addr) {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function mon(wei) {
  const n = Number(formatEther(wei));
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}

function seedDemo(block) {
  const b = Number(block);
  return [
    {
      id: 0,
      title: "Blitz front-row pass",
      startPrice: parseEther("12"),
      floorPrice: parseEther("1.5"),
      startBlock: BigInt(Math.max(0, b - 40)),
      endBlock: BigInt(b - 40 + 280),
      buyer: ZERO,
      seller: ZERO,
    },
    {
      id: 1,
      title: "Whitelist slot",
      startPrice: parseEther("4.2"),
      floorPrice: parseEther("0.4"),
      startBlock: BigInt(Math.max(0, b - 15)),
      endBlock: BigInt(b - 15 + 420),
      buyer: ZERO,
      seller: ZERO,
    },
    {
      id: 2,
      title: "30-min contract review",
      startPrice: parseEther("8"),
      floorPrice: parseEther("2"),
      startBlock: BigInt(Math.max(0, b - 90)),
      endBlock: BigInt(b - 90 + 360),
      buyer: ZERO,
      seller: ZERO,
    },
  ];
}

function livePrice(a, block) {
  if (a.buyer && a.buyer !== ZERO) return a.floorPrice;
  if (block <= a.startBlock) return a.startPrice;
  if (block >= a.endBlock) return a.floorPrice;
  const span = a.endBlock - a.startBlock;
  const elapsed = block - a.startBlock;
  const drop =
    ((a.startPrice - a.floorPrice) * elapsed) / span;
  return a.startPrice - drop;
}

function statusOf(a, block) {
  if (a.buyer && a.buyer !== ZERO) return "cleared";
  if (block >= a.endBlock) return "floor";
  return "falling";
}

function renderAuctions(list) {
  const root = $("auctions");
  root.innerHTML = "";
  for (const a of list) {
    const p = hasContract ? a.livePrice : livePrice(a, blockNumber);
    const st = statusOf(a, blockNumber);
    const left = a.endBlock > blockNumber ? a.endBlock - blockNumber : 0n;
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:start">
        <h2 class="display" style="margin:0;font-size:1.15rem">${a.title}</h2>
        <span class="status">${st}</span>
      </div>
      <div class="price" style="margin-top:0.75rem">${mon(p)} <span style="font-size:0.9rem;color:var(--muted)">MON</span></div>
      <div class="muted" style="font-size:0.8rem;margin-top:0.35rem">
        ${mon(a.startPrice)} → ${mon(a.floorPrice)} · ${left.toString()} blocks left
      </div>
      <button class="btn-primary" data-id="${a.id}" ${st !== "falling" ? "disabled" : ""}>
        ${st === "cleared" ? "Taken" : st === "floor" ? "Closed" : "Snap at this block"}
      </button>
    `;
    root.appendChild(card);
  }
  root.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => onBuy(Number(btn.dataset.id)));
  });
}

function renderTape() {
  const el = $("tape");
  if (!tape.length) {
    el.innerHTML = "<li>No clears yet. Snap a listing during the demo.</li>";
    return;
  }
  el.innerHTML = tape
    .map(
      (t) =>
        `<li>${t.title} · ${t.price} MON · fee ${t.fee} · blk ${t.block}</li>`
    )
    .join("");
}

async function refreshBlock() {
  try {
    blockNumber = await publicClient.getBlockNumber();
    $("blockNum").textContent = blockNumber.toLocaleString();
    $("dot").classList.add("live");
  } catch {
    $("dot").classList.remove("live");
  }
}

async function loadChainAuctions() {
  if (!hasContract) {
    if (!demoAuctions.length) demoAuctions = seedDemo(blockNumber || 1n);
    renderAuctions(demoAuctions);
    return;
  }
  const n = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "count",
  });
  const list = [];
  for (let i = 0n; i < n; i++) {
    const row = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "getAuction",
      args: [i],
    });
    const a = row[0];
    list.push({
      id: Number(i),
      seller: a.seller,
      title: a.title,
      startPrice: a.startPrice,
      floorPrice: a.floorPrice,
      startBlock: a.startBlock,
      endBlock: a.endBlock,
      buyer: a.buyer,
      livePrice: row[1],
    });
  }
  renderAuctions(list.length ? list : []);
  if (!list.length) {
    flash("Contract live, no auctions yet — list one below.");
  }
}

async function ensureWallet() {
  if (!window.ethereum) {
    flash("Install MetaMask (or any injected wallet), then connect.");
    throw new Error("no wallet");
  }
  const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
  account = addr;
  walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: custom(window.ethereum),
  });
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
    });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${CHAIN_ID.toString(16)}`,
            chainName: "Monad Testnet",
            nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [EXPLORER],
          },
        ],
      });
    }
  }
  $("connectBtn").textContent = short(account);
}

async function onBuy(id) {
  try {
    if (!hasContract) {
      const a = demoAuctions.find((x) => x.id === id);
      if (!a || statusOf(a, blockNumber) !== "falling") return;
      const p = livePrice(a, blockNumber);
      a.buyer = account || "0xDemo";
      const fee = (Number(formatEther(p)) * FEE_BPS) / 10_000;
      tape.unshift({
        title: a.title,
        price: mon(p),
        fee: fee.toFixed(4),
        block: blockNumber.toString(),
      });
      flash(`Demo clear “${a.title}” at ${mon(p)} MON (local). Deploy contract for real txs.`);
      renderAuctions(demoAuctions);
      renderTape();
      return;
    }
    await ensureWallet();
    const p = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "price",
      args: [BigInt(id)],
    });
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "buy",
      args: [BigInt(id)],
      value: p,
    });
    flash(`buy() sent: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
    const fee = (Number(formatEther(p)) * FEE_BPS) / 10_000;
    tape.unshift({
      title: `#${id}`,
      price: mon(p),
      fee: fee.toFixed(4),
      block: blockNumber.toString(),
    });
    flash(`Cleared on-chain at ${mon(p)} MON · ${hash.slice(0, 10)}…`);
    renderTape();
    await loadChainAuctions();
  } catch (err) {
    flash(err?.shortMessage || err?.message || String(err));
  }
}

$("connectBtn").addEventListener("click", () => {
  ensureWallet().catch((e) => flash(e.message));
});

$("listForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const title = String(fd.get("title") || "").trim();
  const start = parseEther(String(fd.get("start")));
  const floor = parseEther(String(fd.get("floor")));
  const duration = BigInt(String(fd.get("duration")));
  if (start <= floor) {
    flash("Start must be above floor.");
    return;
  }
  try {
    if (!hasContract) {
      demoAuctions.unshift({
        id: Date.now(),
        title,
        startPrice: start,
        floorPrice: floor,
        startBlock: blockNumber,
        endBlock: blockNumber + duration,
        buyer: ZERO,
        seller: account || ZERO,
      });
      flash(`Listed “${title}” in demo mode.`);
      renderAuctions(demoAuctions);
      return;
    }
    await ensureWallet();
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "create",
      args: [title, start, floor, duration],
    });
    flash(`create() sent: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
    flash(`Listed “${title}” on-chain.`);
    await loadChainAuctions();
  } catch (err) {
    flash(err?.shortMessage || err?.message || String(err));
  }
});

// boot
$("modeLabel").textContent = hasContract ? "On-chain" : "Demo";
$("addrFull").textContent = hasContract ? CONTRACT_ADDRESS : "not set";
$("addrShort").textContent = hasContract ? short(CONTRACT_ADDRESS) : "set after deploy";
if (hasContract) {
  $("configWarn").style.display = "none";
  $("explorerLink").href = `${EXPLORER}/address/${CONTRACT_ADDRESS}`;
}
renderTape();
await refreshBlock();
await loadChainAuctions();
setInterval(async () => {
  await refreshBlock();
  await loadChainAuctions();
}, 2000);
