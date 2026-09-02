"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="py-24 max-w-4xl mx-auto px-4 text-center font-mono text-xs space-y-4">
      <div className="text-aviation text-lg font-bold">404 // NODE NOT FOUND</div>
      <p className="text-zincGrey">The requested route or token does not exist on this network.</p>
      <Link
        href="/"
        className="inline-flex items-center space-x-2 px-4 py-2 bg-dark border border-dark-border text-alabaster hover:border-uranium uppercase"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Overview</span>
      </Link>
    </div>
  );
}
