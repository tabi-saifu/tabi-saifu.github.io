import { useEffect, useRef, useState, type ReactNode } from 'react';

export type ToastFn = (text: string) => void;

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast" role="status">{text}</div>;
}

/** 下からせり上がるシート。スマホの片手操作を前提に、画面下部に主要操作を置く */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current!;
    if (!dlg.open) dlg.showModal();
    return () => dlg.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { if (e.target === ref.current) onClose(); }}
    >
      <div className="sheet-body">
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる">✕</button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

/**
 * 日付の入力欄。iPhone の日付入力は文字が上に寄ったり枠からはみ出したりするので、
 * 見た目は自前で描き、その上に透明な本物の日付入力を重ねて端末の日付選択だけを使う。
 */
export function DateField({ label, value, onChange, placeholder = '選ぶ' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="date-field">
        <span className={`date-text num ${value ? '' : 'empty'}`}>{value ? value.replaceAll('-', '/') : placeholder}</span>
        <span className="date-icon" aria-hidden="true">📅</span>
        <input
          type="date"
          className="date-native"
          aria-label={label}
          value={value}
          onChange={e => onChange(e.target.value)}
          onClick={e => {
            try {
              e.currentTarget.showPicker?.();
            } catch {
              // 端末が対応していなければ、標準の動きに任せる
            }
          }}
        />
      </span>
    </label>
  );
}

export function ErrorNote({ text }: { text: string | null }) {
  return text ? <p className="error" role="alert">{text}</p> : null;
}

/** 取り消せない操作は2回押しで確定する。誤タップ防止のため数秒で元に戻る */
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled }: {
  label: string; confirmLabel: string; onConfirm: () => void; disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`danger ${armed ? 'armed' : ''}`} disabled={disabled}
      onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirmLabel : label}
    </button>
  );
}
