import { motion, AnimatePresence } from "framer-motion";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Dialog({ open, onClose, title, children }: DialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative bg-white rounded-2xl shadow-xl w-[340px] max-h-[70vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
              <div className="text-[13px] font-semibold text-neutral-800">{title}</div>
            </div>

            {/* Body */}
            <div className="px-5 pb-3 overflow-y-auto flex-1 text-[11px] text-neutral-600 leading-relaxed">
              {children}
            </div>

            {/* Footer */}
            <div className="px-5 pb-4 pt-2 flex justify-end">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="text-[10px] font-medium px-4 py-1.5 rounded-lg bg-neutral-800 text-white"
              >
                关闭
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
