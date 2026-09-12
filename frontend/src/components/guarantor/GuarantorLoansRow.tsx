import React from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Link as LinkIcon } from 'lucide-react';
import { useGetUser } from '../../repositories/user';
import type { Loan } from '../../@types/types';
import dayjs from 'dayjs';
import MagicLinkDialog from '../dialogs/MagicLinkDialog';
import { ProgressBar, Stamp } from '../ui';

interface GuarantorLoansRowProps {
    loan: Loan;
    onSelect: () => void;
}

const P = (n: number) => 'P ' + n.toLocaleString();

const stampFor = (status: Loan['status']): { tone: 'amber' | 'good' | 'bad' | 'silver'; dashed?: boolean; solid?: boolean; rotate?: number } => {
    if (status === 'Paid') return { tone: 'good', rotate: -2 };
    if (status === 'Defaulted') return { tone: 'bad', solid: true };
    if (status === 'Pending') return { tone: 'silver', dashed: true };
    if (status === 'Archived') return { tone: 'silver' };
    return { tone: 'amber' };
};

const GuarantorLoansRow: React.FC<GuarantorLoansRowProps> = ({ loan, onSelect }) => {
    const user = useGetUser(loan.clientId);
    const [magicLinkDialogOpen, setMagicLinkDialogOpen] = React.useState(false);

    const displayName = user?.name || loan.clientId;
    const initials = displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
    const pct = loan.principal > 0 ? Math.min(100, Math.max(0, Math.round(((loan.principal - loan.balance) / loan.principal) * 100))) : 0;
    const progressTone = loan.status === 'Paid' ? 'good' as const : loan.status === 'Defaulted' ? 'bad' as const : 'amber' as const;
    const thumbFilter = loan.status === 'Paid' ? 'none'
        : loan.status === 'Pending' ? 'blur(4px) brightness(.5) contrast(.75)'
            : `blur(${((1 - pct / 100) * 1.5).toFixed(2)}px) brightness(${(0.6 + (pct / 100) * 0.4).toFixed(2)}) contrast(${(0.8 + (pct / 100) * 0.2).toFixed(2)})`;
    const stamp = stampFor(loan.status);

    return (
        <div
            className="dev border border-linestrong rounded-tray bg-bay2/70 px-4 py-3.5 flex items-center gap-4 hover:border-amberdeep transition-colors cursor-pointer"
            onClick={onSelect}
        >
            <span
                className="papergrain text-ink grid place-items-center font-mono font-bold text-xs shrink-0 w-10 h-10 rounded"
                style={{ boxShadow: '0 2px 6px rgba(0,0,0,.45), inset 0 0 0 1px rgba(43,32,21,.15)' }}
            >
                <span style={{ filter: thumbFilter }}>{initials}</span>
            </span>

            <div className="min-w-0 flex-1">
                <p className="text-paper font-semibold text-[15px] flex items-baseline gap-1.5 min-w-0">
                    <Link
                        to="/client-statement/$clientId"
                        params={{ clientId: loan.clientId }}
                        className="truncate hover:text-amber hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {displayName}
                    </Link>
                    {user && !user.oidcUid && (
                        <button
                            aria-label="Link OIDC Account"
                            title="Link OIDC Account"
                            className="shrink-0 p-0.5 text-silver hover:text-amber transition-colors"
                            onClick={(e) => { e.stopPropagation(); setMagicLinkDialogOpen(true); }}
                        >
                            <LinkIcon size={13} />
                        </button>
                    )}
                    <span className="font-mono text-xs text-silverdim shrink-0">{loan.alternateId}</span>
                </p>
                <p className="text-sm text-silverdim mt-0.5">
                    {P(loan.principal)} at {loan.interestRate}%/mo · {loan.termMonths} mo · {dayjs(loan.date).format('MMM DD')}
                </p>
            </div>

            <div className="hidden sm:block w-40 shrink-0">
                <ProgressBar value={pct} tone={progressTone} />
                <p className="text-[11px] font-mono text-silverdim mt-1 tnum whitespace-nowrap">{pct}% · {P(loan.balance)} to go</p>
            </div>

            <div className="text-right shrink-0">
                <p className="font-mono font-bold text-paper text-[15px] tnum">{'P ' + loan.balance.toLocaleString()}</p>
                <p className="text-[11px] font-mono tracking-widest uppercase text-silverdim mt-0.5">balance</p>
            </div>

            <div className="shrink-0">
                <Stamp tone={stamp.tone} dashed={stamp.dashed} solid={stamp.solid} rotate={stamp.rotate}>
                    {loan.status}
                </Stamp>
            </div>

            <ArrowRight size={18} className="shrink-0 text-silverdim opacity-50 hidden sm:block" />

            {user && (
                <MagicLinkDialog
                    open={magicLinkDialogOpen}
                    onClose={() => setMagicLinkDialogOpen(false)}
                    userId={user.id}
                    userName={user.name}
                />
            )}
        </div>
    );
};

export default GuarantorLoansRow
