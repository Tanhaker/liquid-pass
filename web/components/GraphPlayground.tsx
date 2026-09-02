"use client";

import React, { useState } from "react";
import { useApolloClient, gql } from "@apollo/client";
import { Play, Database, Code, Terminal } from "lucide-react";

const DEFAULT_QUERY = `{
  plans(first: 5) {
    id
    issuer
    price
    durationSeconds
  }
  passes(first: 5) {
    id
    plan {
      id
    }
    owner
    issuer
  }
}`;

export function GraphPlayground() {
  const client = useApolloClient();
  const [queryText, setQueryText] = useState(DEFAULT_QUERY);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRun = async () => {
    if (!queryText.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      // Parse the query text into a GraphQL AST
      const parsedQuery = gql([queryText] as any);

      const response = await client.query({
        query: parsedQuery,
        fetchPolicy: "network-only", // Always fetch fresh for playground
      });

      setResult(JSON.stringify({ data: response.data }, null, 2));
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while fetching.");
      setResult(JSON.stringify({ errors: [{ message: err.message }] }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-ink border border-dark-border shadow-grunge overflow-hidden h-full min-h-[400px]">
      {/* Playground Header */}
      <div className="flex items-center justify-between bg-dark-card border-b border-dark-border px-4 py-3">
        <div className="flex items-center space-x-3">
          <Terminal className="w-4 h-4 text-uranium" />
          <h3 className="font-header font-bold text-sm text-alabaster tracking-wider">
            LIVE GRAPHQL PLAYGROUND
          </h3>
        </div>
        <div className="flex items-center space-x-4">
          <span className="font-mono text-[10px] text-zincGrey flex items-center gap-1">
            <Database className="w-3 h-3" />
            Apollo Client Connected
          </span>
          <button
            onClick={handleRun}
            disabled={loading}
            className="flex items-center space-x-2 bg-uranium hover:bg-uranium/80 text-black font-bold font-mono text-xs px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-pulse">FETCHING...</span>
            ) : (
              <>
                <Play className="w-3 h-3 fill-black" />
                <span>RUN QUERY</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor & Results Area */}
      <div className="flex flex-col md:flex-row flex-grow h-[450px]">
        {/* Editor (Left) */}
        <div className="flex-1 border-b md:border-b-0 md:border-r border-dark-border relative bg-[#0d0f12]">
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            className="w-full h-full bg-transparent text-periwinkle font-mono text-xs p-4 focus:outline-none resize-none"
            spellCheck={false}
          />
        </div>

        {/* Results (Right) */}
        <div className="flex-1 bg-[#090a0c] relative overflow-auto">
          {result ? (
            <pre className="w-full h-full text-uranium font-mono text-xs p-4 whitespace-pre-wrap">
              {result}
            </pre>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zincGrey font-mono text-xs opacity-50 p-6 text-center">
              <Code className="w-8 h-8 mb-3 opacity-20" />
              Hit "Run Query" to fetch live data from the Arbitrum Stylus subgraph.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
