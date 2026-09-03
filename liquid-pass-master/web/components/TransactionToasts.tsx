"use client";

import React from "react";
import { useLiquidPass } from "@/lib/store";
import { CheckCircle2, AlertTriangle, Loader2, X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function TransactionToasts() {
  const { txNotifications, removeNotification } = useLiquidPass();

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-md w-full pointer-events-none">
      <AnimatePresence>
        {txNotifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className={`pointer-events-auto border p-4 shadow-grunge backdrop-blur-md relative overflow-hidden bg-dark-card/95 ${
              notif.status === "pending"
                ? "border-aviation text-alabaster"
                : notif.status === "success"
                ? "border-uranium text-alabaster"
                : "border-red-500 text-alabaster"
            }`}
          >
            {/* Top scanning line for pending */}
            {notif.status === "pending" && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-aviation to-transparent animate-pulse" />
            )}
            {notif.status === "success" && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-uranium" />
            )}

            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  {notif.status === "pending" && (
                    <Loader2 className="w-5 h-5 text-aviation animate-spin" />
                  )}
                  {notif.status === "success" && (
                    <CheckCircle2 className="w-5 h-5 text-uranium" />
                  )}
                  {notif.status === "error" && (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-dark border border-dark-border text-zincGrey">
                      {notif.status === "pending" ? "TX_BROADCAST" : notif.status === "success" ? "TX_CONFIRMED" : "TX_ERROR"}
                    </span>
                    <h4 className="font-header font-bold text-sm text-alabaster tracking-tight">
                      {notif.title}
                    </h4>
                  </div>
                  <p className="mt-1 font-body text-xs text-zincGrey leading-relaxed">
                    {notif.message}
                  </p>
                  {notif.txHash && (
                    <a
                      href={`https://sepolia.arbiscan.io/tx/${notif.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center space-x-1 font-mono text-[11px] text-periwinkle hover:underline"
                    >
                      <span>ARBISCAN: {notif.txHash}</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  )}
                </div>
              </div>

              <button
                onClick={() => removeNotification(notif.id)}
                className="text-zincGrey hover:text-alabaster transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
