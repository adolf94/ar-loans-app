import React, { useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    Send,
    RefreshCw,
    MessageSquare,
    ArrowRightLeft,
    Reply
} from 'lucide-react';
import { useLogs } from '../../repositories/log';
import apiClient from '../../services/api';
import { Tabs, Button, IconButton, Panel, Stamp, Label } from '../ui';

const LogRow: React.FC<{ log: any, onReply: (chatId: string) => void }> = ({ log, onReply }) => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <tr className="hover:bg-tray/50 transition-colors">
                <td className="px-4 py-3 w-12">
                    <IconButton label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen(!open)}>
                        {open ? <ChevronUp size={16} strokeWidth={1.7} /> : <ChevronDown size={16} strokeWidth={1.7} />}
                    </IconButton>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-silverdim whitespace-nowrap">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                <td className="px-4 py-3">
                    <Stamp tone={log.level === 'Error' ? 'bad' : 'amber'} dashed={log.source !== 'AdminDashboard'} solid={log.source === 'AdminDashboard'}>
                        {log.level || 'Info'}
                    </Stamp>
                </td>
                <td className="px-4 py-3 text-silver">{log.source || '-'}</td>
                <td className="px-4 py-3 text-paper">{log.message || '-'}</td>
                <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                        <span className="font-mono text-sm text-paper tnum">{log.chatId || '-'}</span>
                        {log.chatId && (
                            <IconButton label="Reply" onClick={() => onReply(log.chatId)}>
                                <Reply size={14} strokeWidth={1.7} />
                            </IconButton>
                        )}
                    </span>
                </td>
            </tr>
            {open && (
                <tr>
                    <td colSpan={6} className="p-0">
                        <div className="mx-4 my-2 bg-bay border border-line rounded-md p-3">
                            <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim mb-2">
                                JSON Data
                            </p>
                            <pre className="m-0 text-xs overflow-auto text-silver font-mono">
                                {JSON.stringify(log.data, null, 2)}
                            </pre>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

const MessagesTab: React.FC = () => {
    const { data, isLoading, refetch, error } = { data: [], isLoading: false, refetch: () => { }, error: null };
    const [activePanel, setActivePanel] = useState(0); // 0: Inbound, 1: Outbound

    // Inbound Simulation State
    const [simMessage, setSimMessage] = useState('');
    const [simChatId, setSimChatId] = useState('-5297561727');
    const [simUser, setSimUser] = useState('AdminTester');

    // Outbound Real State
    const [realMessage, setRealMessage] = useState('');
    const [realChatId, setRealChatId] = useState('-5297561727');

    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Safeguard logs against non-array responses
    const logs = Array.isArray(data) ? data : [];

    const handleSendSimulation = async () => {
        setIsProcessing(true);
        setStatus(null);
        try {
            const payload = {
                update_id: Math.floor(Math.random() * 1000000),
                message: {
                    message_id: Math.floor(Math.random() * 1000),
                    from: { id: 12345, is_bot: false, first_name: simUser, username: simUser },
                    chat: { id: parseInt(simChatId), title: 'Test Group', type: 'group' },
                    date: Math.floor(Date.now() / 1000),
                    text: simMessage
                }
            };
            await apiClient.post('/telegram/webhook', payload);
            setStatus({ type: 'success', message: 'Webhook simulation sent!' });
            setSimMessage('');
            setTimeout(() => refetch(), 1000);
        } catch (err: any) {
            setStatus({ type: 'error', message: `Simulation failed: ${err.message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendReal = async () => {
        setIsProcessing(true);
        setStatus(null);
        try {
            await apiClient.post('/Telegram/send', {
                chatId: realChatId,
                text: realMessage
            });
            setStatus({ type: 'success', message: 'Real message sent to Telegram!' });
            setRealMessage('');
            setTimeout(() => refetch(), 1000);
        } catch (err: any) {
            setStatus({ type: 'error', message: `Real send failed: ${err.message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    const onReply = (chatId: string) => {
        setRealChatId(chatId);
        setActivePanel(1);
    };

    return (
        <div className="py-2">
            <div className="grid gap-6 lg:grid-cols-3">
                <div>
                    <Panel pad={false} className="overflow-hidden">
                        <Tabs
                            value={String(activePanel)}
                            onChange={(v) => setActivePanel(Number(v))}
                            items={[
                                { value: '0', label: 'Inbound' },
                                { value: '1', label: 'Outbound' }
                            ]}
                        />
                        <div className="p-5">
                            {activePanel === 0 ? (
                                <div className="space-y-4">
                                    <div>
                                        <Label>Simulated Chat ID</Label>
                                        <input
                                            className="w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:border-amberdeep"
                                            value={simChatId}
                                            onChange={(e) => setSimChatId(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Simulated User</Label>
                                        <input
                                            className="w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:border-amberdeep"
                                            value={simUser}
                                            onChange={(e) => setSimUser(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Simulated Message</Label>
                                        <textarea
                                            rows={4}
                                            className="w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:border-amberdeep"
                                            value={simMessage}
                                            onChange={(e) => setSimMessage(e.target.value)}
                                        />
                                    </div>
                                    <Button fullWidth startIcon={<ArrowRightLeft size={18} strokeWidth={1.7} />} onClick={handleSendSimulation} disabled={isProcessing || !simMessage}>
                                        Simulate Webhook
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <Label>Target Chat ID</Label>
                                        <input
                                            className="w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:border-amberdeep"
                                            value={realChatId}
                                            onChange={(e) => setRealChatId(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Actual Message (Markdown)</Label>
                                        <textarea
                                            rows={4}
                                            placeholder="Hello from Admin Dashboard..."
                                            className="w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-silverdim focus:border-amberdeep"
                                            value={realMessage}
                                            onChange={(e) => setRealMessage(e.target.value)}
                                        />
                                    </div>
                                    <Button fullWidth startIcon={<Send size={18} strokeWidth={1.7} />} onClick={handleSendReal} disabled={isProcessing || !realMessage}>
                                        Send to Telegram API
                                    </Button>
                                </div>
                            )}

                            {status && (
                                <div className={`mt-4 border rounded-tray px-4 py-3 text-sm ${status.type === 'error' ? 'border-bad/60 bg-bad/10 text-bad' : 'border-linestrong bg-tray/50 text-good'}`} role="alert">
                                    {status.message}
                                </div>
                            )}
                        </div>
                    </Panel>
                </div>

                <div className="lg:col-span-2">
                    <Panel pad={false} className="overflow-hidden">
                        <div className="px-4 py-3 flex justify-between items-center border-b border-line">
                            <div>
                                <p className="text-paper font-semibold text-lg tracking-tight flex items-center gap-2">
                                    <MessageSquare size={20} strokeWidth={1.7} /> System Messages (Live)
                                </p>
                                {error && (
                                    <p className="text-xs text-bad">
                                        Error: {(error as any).message}
                                    </p>
                                )}
                            </div>
                            <IconButton label="Refresh messages" onClick={() => refetch()} disabled={isLoading}>
                                <RefreshCw size={18} strokeWidth={1.7} className={isLoading ? 'animate-spin' : ''} />
                            </IconButton>
                        </div>
                        <div className="max-h-[650px] overflow-auto">
                            <table className="w-full text-sm min-w-[640px]">
                                <thead>
                                    <tr className="text-left text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim border-b border-linestrong">
                                        <th className="px-4 py-3 w-12" />
                                        <th className="px-4 py-3 font-medium">Time</th>
                                        <th className="px-4 py-3 font-medium">Level</th>
                                        <th className="px-4 py-3 font-medium">Source</th>
                                        <th className="px-4 py-3 font-medium">Message</th>
                                        <th className="px-4 py-3 font-medium">Chat Context</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line/70">
                                    {logs.length > 0 ? (
                                        logs.map((log: any) => (
                                            <LogRow key={log.id} log={log} onReply={onReply} />
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-silverdim">
                                                {isLoading ? 'Loading fresh messages...' : 'No system messages found.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
};

export default MessagesTab;
