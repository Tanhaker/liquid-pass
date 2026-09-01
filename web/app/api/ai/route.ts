import { NextResponse } from "next/server";
import { formatEther } from "viem";
import { LIQUID_PASS_ADDRESS } from "@/lib/contract";
import { fetchActivity, fetchPasses, fetchPlans } from "@/lib/data";
import { retrieve } from "@/lib/knowledge";

/**
 * Liquid AI.
 *
 * Server-side so OPENAI_API_KEY never reaches the browser.
 *
 * The design rule that matters: the model is given product knowledge from the
 * repo and a live snapshot of chain state, and is told to answer ONLY from
 * those. It is explicitly forbidden from inventing chain data. A confident
 * assistant stating a wrong balance or a wrong expiry in front of a judge is
 * worse than no assistant, so the failure mode is "I don't know", not a guess.
 *
 * Without a key, the endpoint still answers from the knowledge base directly.
 * That is a real degradation, and it is labelled as such in the response --
 * never dressed up as the model having replied.
 */

export const maxDuration = 30;

type Body = { question?: string; address?: string };

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.OPENAI_API_KEY) });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const question = (body.question ?? "").trim().slice(0, 500);
  if (!question) {
    return NextResponse.json({ error: "`question` is required" }, { status: 400 });
  }

  const docs = retrieve(question);

  // Chain state is fetched fresh per question rather than cached, so "how many
  // passes are active" cannot answer with a stale number.
  let snapshot = "";
  let chainFailed = false;
  try {
    const [plans, passes, activity] = await Promise.all([
      fetchPlans(),
      fetchPasses(),
      fetchActivity(20),
    ]);
    const now = Math.floor(Date.now() / 1000);
    const sold = passes.filter((p) => p.paid > 0n);
    const mine = body.address
      ? passes.filter((p) => p.owner.toLowerCase() === body.address!.toLowerCase())
      : [];

    snapshot = [
      `Contract: ${LIQUID_PASS_ADDRESS} on Arbitrum Sepolia.`,
      `Plans (${plans.length}): ${plans
        .map(
          (p) =>
            `#${p.id} "${p.name}" ${formatEther(p.price)} ETH for ${Number(p.duration) / 86400}d, ${p.open ? "open" : "closed"}`,
        )
        .join("; ")}`,
      `Passes issued: ${passes.length}, sold via a plan: ${sold.length}, active now: ${
        sold.filter((p) => Number(p.expiry) > now).length
      }.`,
      `Currently listed: ${passes
        .filter((p) => p.listed > 0n && Number(p.expiry) > now)
        .map(
          (p) =>
            `pass #${p.tokenId} at ${formatEther(p.listed)} ETH, ${Math.floor(
              (Number(p.expiry) - now) / 86400,
            )}d left, originally ${p.paid > 0n ? formatEther(p.paid) + " ETH" : "not sold"}`,
        )
        .join("; ") || "none"}`,
      body.address
        ? `The person asking owns ${mine.length} pass(es): ${
            mine
              .map(
                (p) =>
                  `#${p.tokenId} (${Math.max(0, Math.floor((Number(p.expiry) - now) / 86400))}d left${
                    p.listed > 0n ? ", listed" : ""
                  })`,
              )
              .join(", ") || "none"
          }.`
        : "The person asking has not connected a wallet, so their own passes are unknown.",
      `Recent events: ${activity
        .slice(0, 8)
        .map((a) => `${a.kind}${a.tokenId !== undefined ? ` #${a.tokenId}` : ""}`)
        .join(", ")}`,
    ].join("\n");
  } catch {
    chainFailed = true;
    snapshot = "Live chain data could not be read for this question.";
  }

  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    // Honest fallback: the knowledge base, verbatim, clearly labelled.
    return NextResponse.json({
      answer: docs.length
        ? docs.map((d) => d.text).join("\n\n")
        : "I can answer questions about how Liquid Pass works — buying, reselling, expiry, and the 90/10 split. Try asking one of those.",
      sources: docs.map((d) => d.title),
      mode: "knowledge-base",
      note: "Liquid AI is running without a language model (OPENAI_API_KEY is not set), so this is the product documentation returned directly rather than a generated answer.",
      chainFailed,
    });
  }

  const system = [
    "You are Liquid AI, the assistant built into the Liquid Pass marketplace.",
    "Answer ONLY from the PRODUCT KNOWLEDGE and CHAIN SNAPSHOT provided below.",
    "Never invent contract behaviour, balances, prices, token ids, addresses or transaction hashes.",
    "If the answer is not in what you were given, say you do not know and suggest where to look in the app.",
    "If the chain snapshot says data could not be read, say so plainly rather than guessing.",
    "Be concise: two or three sentences unless asked for detail. No markdown headings, no bullet lists unless listing passes.",
    "Never give financial or investment advice. This is testnet; the ETH has no monetary value.",
    "",
    "PRODUCT KNOWLEDGE:",
    docs.length ? docs.map((d) => `- ${d.title}: ${d.text}`).join("\n") : "(no closely matching documentation)",
    "",
    "CHAIN SNAPSHOT (live, read just now):",
    snapshot,
  ].join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: "system", content: system },
          { role: "user", content: question },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          error: "The language model rejected the request",
          detail: text.slice(0, 200),
          // The knowledge base still answers, so the user is not left empty-handed.
          answer: docs.map((d) => d.text).join("\n\n") || undefined,
          mode: "knowledge-base",
        },
        { status: 502 },
      );
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = json.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return NextResponse.json({ error: "Empty response from the model" }, { status: 502 });
    }

    return NextResponse.json({
      answer,
      sources: docs.map((d) => d.title),
      mode: "model",
      chainFailed,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Could not reach the language model",
        detail: (e as Error).message,
        answer: docs.map((d) => d.text).join("\n\n") || undefined,
        mode: "knowledge-base",
      },
      { status: 502 },
    );
  }
}
