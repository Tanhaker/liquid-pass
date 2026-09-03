const ADDRESS = "0x490630168df621c98e6bba22549295a2202de358";

const urls = [
  `https://api.etherscan.io/v2/api?chainid=421614&module=account&action=txlist&address=${ADDRESS}&startblock=0&endblock=99999999&page=1&offset=25&sort=desc`,
  `https://api-sepolia.arbiscan.io/api?module=account&action=txlist&address=${ADDRESS}&startblock=0&endblock=99999999&page=1&offset=25&sort=desc`,
];

for (const url of urls) {
  try {
    const r = await fetch(url);
    const j = await r.json();
    console.log(`\n--- ${url.split("?")[0]} ---`);
    console.log(`status=${j.status} message=${j.message}`);
    if (Array.isArray(j.result)) {
      console.log(`${j.result.length} transactions\n`);
      for (const t of j.result) {
        const sel = (t.input || "").slice(0, 10);
        console.log(`block ${t.blockNumber}  isError=${t.isError}  ${t.hash}`);
        console.log(`  from ${t.from}  selector ${sel}  gasUsed ${t.gasUsed}`);
        if (sel === "0xd66d6c10" && t.input.length >= 138) {
          const x = BigInt("0x" + t.input.slice(10, 74));
          const y = BigInt("0x" + t.input.slice(74, 138));
          console.log(`  REGISTER x=0x${x.toString(16).padStart(64,"0")}`);
          console.log(`           y=0x${y.toString(16).padStart(64,"0")}`);
          console.log(`           x zero? ${x === 0n}  y zero? ${y === 0n}`);
        }
        if (t.input && t.input.length > 10 && sel !== "0xd66d6c10") {
          console.log(`  input ${t.input.slice(0, 160)}${t.input.length > 160 ? "..." : ""}`);
        }
      }
      if (j.result.length) break;
    } else {
      console.log(`result: ${JSON.stringify(j.result).slice(0, 200)}`);
    }
  } catch (e) {
    console.log(`failed: ${e.message}`);
  }
}
