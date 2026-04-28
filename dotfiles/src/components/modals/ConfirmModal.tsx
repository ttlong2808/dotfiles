import { useState } from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText: string;
  /** If set, user must type this value to enable confirm button */
  confirmValue?: string;
  variant: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES = {
  danger: {
    button: 'bg-transparent border border-error text-error hover:bg-error/10 disabled:opacity-40',
    icon: 'error',
    iconColor: 'text-error',
  },
  warning: {
    button: 'bg-transparent border border-warning text-warning hover:bg-warning/10 disabled:opacity-40',
    icon: 'warning',
    iconColor: 'text-warning',
  },
  info: {
    button: 'bg-primary text-on-primary hover:brightness-110 disabled:opacity-40',
    icon: 'info',
    iconColor: 'text-primary',
  },
};

export default function ConfirmModal({
  title,
  message,
  confirmText,
  confirmValue,
  variant,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = useState('');
  const style = VARIANT_STYLES[variant];

  const isEnabled = confirmValue ? inputValue === confirmValue : true;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        className="relative bg-surface-high border border-cyan-900/50 rounded-sm w-[480px] max-w-[90vw] shadow-2xl"
        style={{ animation: 'modal-in 120ms ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-900/30">
          <h2 className="text-[16px] font-semibold text-on-background">{title}</h2>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="flex gap-3 mb-4">
            <span className={`material-symbols-outlined text-[20px] ${style.iconColor} shrink-0 mt-0.5`}>
              {style.icon}
            </span>
            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              {message}
            </p>
          </div>

          {confirmValue && (
            <div className="mt-4">
              <label className="block font-code text-[10px] text-slate-500 uppercase font-bold mb-1.5 tracking-widest">
                Type "{confirmValue}" to confirm
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={confirmValue}
                className="w-full bg-surface-lowest border border-outline-variant rounded-sm py-2 px-3 font-code text-[13px] text-on-surface placeholder:text-slate-600 focus:border-primary/50 focus:outline-none transition-colors"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-cyan-900/30">
          <button
            onClick={onCancel}
            className="bg-transparent border border-outline-variant text-on-surface-variant hover:text-on-surface font-code text-[11px] font-bold px-4 py-2 rounded-sm transition-colors uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isEnabled}
            className={`font-code text-[11px] font-bold px-4 py-2 rounded-sm transition-all uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed ${style.button}`}
          >
            <span className="material-symbols-outlined text-[14px] align-middle mr-1">
              {variant === 'danger' ? 'delete' : 'check'}
            </span>
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modal-in {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
