import { createPublicClient, http, parseAbi } from "viem";
import { arbitrumSepolia } from "viem/chains";
const C="0x22703fdd3dd77f854ca111e581bbd84cf82c1d36";
const pub=createPublicClient({chain:arbitrumSepolia,transport:http("https://sepolia-rollup.arbitrum.io/rpc")});
const abi=parseAbi(["function nextTokenId() view returns (uint256)","function ownerOf(uint256) view returns (address)","function expiryOf(uint256) view returns (uint256)","function isActive(uint256) view returns (bool)","function planOf(uint256) view returns (uint256)","function paidOf(uint256) view returns (uint256)"]);
const r=(f,a=[])=>pub.readContract({address:C,abi,functionName:f,args:a});
const n=Number(await r("nextTokenId"));
const now=Math.floor(Date.now()/1000);
const target="0xf5AbE5a5092Af1a7fA31109C98635440fdD83174".toLowerCase();

// Exactly what /verify now does: filter on the contract's isActive.
const owned=[];
for(let i=0;i<n;i++){
  const o=await r("ownerOf",[BigInt(i)]);
  if(o.toLowerCase()!==target) continue;
  owned.push({id:i, plan:Number(await r("planOf",[BigInt(i)])), active:await r("isActive",[BigInt(i)]), expiry:Number(await r("expiryOf",[BigInt(i)])), paid:await r("paidOf",[BigInt(i)])});
}
console.log("passes held by 0xf5Ab…3174:");
for(const p of owned) console.log(`  #${p.id} plan=${p.plan} ends=${((p.expiry-now)/86400).toFixed(1).padStart(5)}d active=${p.active}`);

const cursor = owned.filter(p=>p.plan===3 && p.paid>0n);
const live = cursor.filter(p=>p.active);
console.log(`\n/verify with plan = Cursor Pro (#3):`);
console.log(`  passes for that plan : ${cursor.map(p=>"#"+p.id).join(", ")||"none"}`);
console.log(`  contract says active : ${live.map(p=>"#"+p.id).join(", ")||"NONE"}`);
console.log(`  -> ${live.length? "ACCESS GRANTED via #"+live[0].id : "DENIED — window hasn't started"}`);
console.log(`\n  BEFORE the fix this granted access via #5 (active=false).`);
