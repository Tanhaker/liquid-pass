"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-24 text-center font-mono text-xs">
      <div className="text-lg font-bold text-aviation">404 // NODE NOT FOUND</div>
      <p className="text-zincGrey">
        The requested route or token does not exist on this network. The
        marketplace is still running.
      </p>
      <Link
        href="/market"
        className="inline-flex items-center space-x-2 border border-dark-border bg-dark px-4 py-2 uppercase text-alabaster transition-colors hover:border-uranium hover:text-uranium"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Return to Marketplace</span>
      </Link>
    </div>
  );
}
