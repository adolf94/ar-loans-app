import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ============================== Button ============================== */
type ButtonVariant = 'amber' | 'ink' | 'ghost' | 'danger' | 'outline';
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: 'sm' | 'md' | 'lg';
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
    loading?: boolean;
    fullWidth?: boolean;
};

const buttonVariants: Record<ButtonVariant, string> = {
    amber: 'bg-amber text-ink hover:bg-paper font-semibold',
    ink: 'bg-ink text-paper hover:bg-inksoft font-semibold',
    ghost: 'text-silver hover:text-paper bg-transparent hover:bg-tray/70 font-medium',
    outline: 'border border-linestrong text-silver hover:text-paper hover:border-amberdeep bg-transparent font-medium',
    danger: 'bg-bad text-bay hover:bg-paper font-semibold',
};

const buttonSizes = {
    sm: 'text-sm px-3 py-1.5 rounded-md',
    md: 'text-sm px-4 py-2.5 rounded-md',
    lg: 'text-[15px] px-5 py-3 rounded-md',
};

export const Button: React.FC<ButtonProps> = ({ variant = 'amber', size = 'md', startIcon, endIcon, loading, fullWidth, className = '', children, disabled, ...rest }) => (
    <button
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${buttonVariants[variant]} ${buttonSizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...rest}
    >
        {loading ? <Spinner size={14} /> : startIcon}
        {children}
        {endIcon}
    </button>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }> = ({ label, className = '', children, ...rest }) => (
    <button aria-label={label} title={label} className={`p-2 border border-line rounded-md text-silver hover:text-amber hover:border-amberdeep transition-colors ${className}`} {...rest}>
        {children}
    </button>
);

/* ============================== Fields ============================== */
export const Label: React.FC<{ htmlFor?: string; children: React.ReactNode; className?: string }> = ({ htmlFor, children, className = '' }) => (
    <label htmlFor={htmlFor} className={`block text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim mb-1.5 ${className}`}>{children}</label>
);

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string | false };
export const Input: React.FC<InputProps> = ({ label, error, className = '', id, ...rest }) => (
    <div className="w-full">
        {label && <Label htmlFor={id}>{label}</Label>}
        <input id={id} className={`w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-silverdim transition-colors focus:border-amberdeep ${error ? 'border-bad' : ''} ${className}`} {...rest} />
        {error && <p className="mt-1.5 text-xs text-bad" role="alert">{error}</p>}
    </div>
);

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string };
export const Textarea: React.FC<TextareaProps> = ({ label, className = '', id, ...rest }) => (
    <div className="w-full">
        {label && <Label htmlFor={id}>{label}</Label>}
        <textarea id={id} className={`w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-silverdim focus:border-amberdeep ${className}`} {...rest} />
    </div>
);

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string | number; label: string; disabled?: boolean }[] };
export const Select: React.FC<SelectProps> = ({ label, options, className = '', id, ...rest }) => (
    <div className="w-full">
        {label && <Label htmlFor={id}>{label}</Label>}
        <select id={id} className={`w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper ${className}`} {...rest}>
            {options.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
    </div>
);

export const Checkbox: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, className = '', ...rest }) => (
    <label className={`inline-flex items-center gap-2 text-sm text-silverdim cursor-pointer select-none ${className}`}>
        <input type="checkbox" className="accent-amber w-4 h-4" {...rest} />
        {label}
    </label>
);

/* ============================== Surfaces ============================== */
export const Panel: React.FC<React.HTMLAttributes<HTMLDivElement> & { pad?: boolean }> = ({ pad = true, className = '', children, ...rest }) => (
    <div className={`border border-linestrong rounded-tray bg-bay2/70 ${pad ? 'p-4 sm:p-5' : ''} ${className}`} {...rest}>{children}</div>
);

export const Paper: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
    <div className={`papergrain text-ink rounded-print ${className}`} {...rest}>{children}</div>
);

export const Divider: React.FC<{ className?: string }> = ({ className = '' }) => <hr className={`border-line ${className}`} />;

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-label="Loading">
        <circle cx="12" cy="12" r="9" stroke="#4d3620" strokeWidth="2.5" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="#ffb224" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-tray rounded-md ${className}`} />
);

export const ProgressBar: React.FC<{ value: number; tone?: 'amber' | 'good' | 'bad'; className?: string }> = ({ value, tone = 'amber', className = '' }) => (
    <div className={`h-1.5 rounded-full bg-bay overflow-hidden border border-line ${className}`}>
        <div className={`h-full rounded-full ${tone === 'good' ? 'bg-good' : tone === 'bad' ? 'bg-bad' : 'bg-amber'}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
);

/* ============================== Stamp (Chip) ============================== */
type StampTone = 'amber' | 'good' | 'bad' | 'safelight' | 'silver' | 'paper';
export const Stamp: React.FC<{ tone?: StampTone; dashed?: boolean; solid?: boolean; rotate?: number; className?: string; children: React.ReactNode }> = ({ tone = 'amber', dashed, solid, rotate, className = '', children }) => {
    const tones: Record<StampTone, string> = {
        amber: 'text-amber', good: 'text-good', bad: 'text-bad', safelight: 'text-safelight', silver: 'text-silverdim', paper: 'text-amberdeep',
    };
    return (
        <span className={`stamp ${tones[tone]} ${dashed ? 'stamp-dash' : ''} ${solid ? 'stamp-solid' : ''} ${className}`}
            style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}>
            {children}
        </span>
    );
};

/* ============================== Tabs ============================== */
export const Tabs: React.FC<{ value: string; onChange: (v: string) => void; items: { value: string; label: string; badge?: number }[]; className?: string }> = ({ value, onChange, items, className = '' }) => (
    <div role="tablist" className={`flex gap-1 overflow-x-auto border-b border-line ${className}`}>
        {items.map(t => (
            <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-2 ${value === t.value ? 'border-amber text-amber' : 'border-transparent text-silverdim hover:text-silver'}`}>
                {t.label}
                {t.badge != null && t.badge > 0 && <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-amber text-ink font-bold">{t.badge}</span>}
            </button>
        ))}
    </div>
);

/* ============================== Dialog ============================== */
export const Dialog: React.FC<{
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
    width?: string;
    paper?: boolean;
}> = ({ open, onClose, title, children, actions, width = 'max-w-lg', paper }) => {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    }, [open, onClose]);
    if (!open) return null;
    return createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-bay/80 p-4 sm:p-8" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={`${width} mx-auto ${paper ? 'papergrain text-ink rounded-print shadow-[0_18px_60px_rgba(0,0,0,.6)]' : 'border border-linestrong rounded-tray bg-bay2 shadow-[0_18px_60px_rgba(0,0,0,.6)]'} ${paper ? 'p-7 sm:p-10' : 'p-5 sm:p-6'}`}>
                {title && <h2 className={`${paper ? 'text-ink' : 'text-paper'} font-semibold text-xl tracking-tight mb-4`}>{title}</h2>}
                {children}
                {actions && <div className="mt-5 flex items-center justify-end gap-3">{actions}</div>}
            </div>
        </div>,
        document.body
    );
};

/* ============================== Menu ============================== */
export const Menu: React.FC<{ trigger: React.ReactNode; items: { label: string; onClick: () => void; divider?: boolean }[]; align?: 'left' | 'right' }> = ({ trigger, items, align = 'right' }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);
    return (
        <div ref={ref} className="relative inline-block">
            <div onClick={() => setOpen(o => !o)}>{trigger}</div>
            {open && (
                <div className={`absolute z-40 mt-1.5 min-w-[180px] border border-linestrong rounded-tray bg-bay2 shadow-[0_10px_40px_rgba(0,0,0,.55)] overflow-hidden ${align === 'right' ? 'right-0' : 'left-0'}`} role="menu">
                    {items.map((it, i) => (
                        <React.Fragment key={i}>
                            {it.divider && <div className="border-t border-line" />}
                            <button role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-silver hover:text-paper hover:bg-tray/70 transition-colors">
                                {it.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ============================== Toast ============================== */
type ToastMsg = { id: number; message: string; tone: 'success' | 'error' };
const ToastCtx = createContext<(message: string, tone?: 'success' | 'error') => void>(() => { });
export const useToast = () => useContext(ToastCtx);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMsg[]>([]);
    const push = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
        const id = Date.now() + Math.random();
        setToasts(t => [...t, { id, message, tone }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000);
    }, []);
    return (
        <ToastCtx.Provider value={push}>
            {children}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] space-y-2 w-max max-w-[92vw]">
                {toasts.map(t => (
                    <div key={t.id} className={`papergrain text-ink px-5 py-3.5 rounded-md shadow-[0_10px_40px_rgba(0,0,0,.55)] flex items-center gap-3 text-sm font-medium pulse-fix`} role="status" aria-live="polite">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.tone === 'error' ? '#c0392b' : '#5f8c3f'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {t.tone === 'error'
                                ? <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>
                                : <path d="M5 13l4 4L19 7" />}
                        </svg>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
};

/* ============================== Confirm ============================== */
type ConfirmOptions = { title?: string; description?: string; confirmationText?: string; cancellationText?: string };
const ConfirmCtx = createContext<(o?: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<{ options: ConfirmOptions; resolve: (b: boolean) => void } | null>(null);
    const confirm = useCallback((o: ConfirmOptions = {}) => new Promise<boolean>(resolve => setState({ options: o, resolve })), []);
    const done = (b: boolean) => { state?.resolve(b); setState(null); };
    return (
        <ConfirmCtx.Provider value={confirm}>
            {children}
            {state && (
                <Dialog open onClose={() => done(false)} title={state.options.title}>
                    {state.options.description && <p className="text-sm text-silver leading-relaxed">{state.options.description}</p>}
                    <div className="mt-5 flex items-center justify-end gap-3">
                        <Button variant="ghost" onClick={() => done(false)}>{state.options.cancellationText || 'Cancel'}</Button>
                        <Button variant="amber" onClick={() => done(true)}>{state.options.confirmationText || 'Confirm'}</Button>
                    </div>
                </Dialog>
            )}
        </ConfirmCtx.Provider>
    );
};

/* ============================== Misc ============================== */
export const LinearProgress: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`h-1 w-full overflow-hidden bg-bay rounded-full ${className}`}>
        <div className="h-full w-1/3 bg-amber rounded-full animate-pulse" />
    </div>
);

export const Avatar: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => (
    <span className={`w-8 h-8 rounded-full bg-trayedge text-amber grid place-items-center font-mono text-xs font-bold shrink-0 ${className}`}>
        {name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
    </span>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; action?: React.ReactNode; className?: string }> = ({ children, action, className = '' }) => (
    <div className={`flex items-baseline justify-between gap-4 flex-wrap ${className}`}>
        <h2 className="text-paper font-semibold text-xl tracking-tight">{children}</h2>
        {action}
    </div>
);

export const Figure: React.FC<{ value: string; label: string; tone?: 'silver' | 'good' | 'safelight' | 'bad'; className?: string }> = ({ value, label, tone = 'silver', className = '' }) => {
    const tones = { silver: 'text-silver', good: 'text-good', safelight: 'text-safelight', bad: 'text-bad' };
    return (
        <div className={className}>
            <p className={`${tones[tone]} font-bold text-lg tnum`}>{value}</p>
            <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim mt-0.5">{label}</p>
        </div>
    );
};
