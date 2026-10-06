"use client";

import { motion } from "framer-motion";
import { Phone, X, Wrench } from "lucide-react";

interface Props {
  onClose: () => void;
  roomTitle?: string;
}

/**
 * Voice call modal — currently a STUB.
 * Per master spec: "При нажатии на кнопку 'Подключиться к голосу' выводить
 * красивую модалку: 'Голосовая связь находится в разработке 🛠️. Используйте
 * чат лобби!'"
 */
export function VoiceCallModal({ onClose, roomTitle }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="glass-card p-6 max-w-sm w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon with animated pulse */}
        <div className="relative w-20 h-20 mx-auto mb-4">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 rounded-full bg-primary/30"
          />
          <div className="relative w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center border-2 border-primary/40">
            <Wrench className="w-9 h-9 text-primary" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-lg font-bold mb-1">Голосовая связь</h2>
        {roomTitle && (
          <p className="text-xs text-muted-foreground mb-3">в комнате «{roomTitle}»</p>
        )}

        {/* Body */}
        <p className="text-sm text-muted-foreground mb-1">
          🛠️ В разработке
        </p>
        <p className="text-sm text-foreground/80 mb-5">
          Используйте чат лобби для общения!
        </p>

        {/* Buttons */}
        <div className="flex gap-2">
          <button onClick={onClose} className="neon-btn flex-1 text-sm">
            Понятно
          </button>
        </div>

        {/* Hint */}
        <p className="text-[10px] text-muted-foreground/50 mt-4 flex items-center justify-center gap-1">
          <Phone className="w-2.5 h-2.5" />
          Скоро: голосовые комнаты через WebRTC
        </p>
      </motion.div>
    </motion.div>
  );
}
