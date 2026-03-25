import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Collapse,
    TextField,
    Button,
    Stack,
    Divider,
    Alert,
    Tabs,
    Tab,
    Grid
} from '@mui/material';
import {
    ChevronDown,
    ChevronUp,
    Send,
    RefreshCw,
    MessageSquare,
    Terminal,
    ArrowRightLeft,
    Reply
} from 'lucide-react';
import { useLogs } from '../../repositories/log';
import apiClient from '../../services/api';

const LogRow: React.FC<{ log: any, onReply: (chatId: string) => void }> = ({ log, onReply }) => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
                <TableCell width="50">
                    <IconButton size="small" onClick={() => setOpen(!open)}>
                        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </IconButton>
                </TableCell>
                <TableCell>{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</TableCell>
                <TableCell>
                    <Chip
                        label={log.level || 'Info'}
                        size="small"
                        color={log.level === 'Error' ? 'error' : 'primary'}
                        variant={log.source === 'AdminDashboard' ? 'filled' : 'outlined'}
                    />
                </TableCell>
                <TableCell>{log.source || '-'}</TableCell>
                <TableCell>{log.message || '-'}</TableCell>
                <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{log.chatId || '-'}</Typography>
                        {log.chatId && (
                            <IconButton size="small" onClick={() => onReply(log.chatId)}>
                                <Reply size={14} />
                            </IconButton>
                        )}
                    </Stack>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1, bgcolor: '#f8fafc', p: 2, borderRadius: 1, border: '1px solid #e2e8f0' }}>
                            <Typography variant="overline" color="text.secondary" gutterBottom>
                                JSON Data
                            </Typography>
                            <pre style={{ margin: 0, fontSize: '0.8rem', overflow: 'auto' }}>
                                {JSON.stringify(log.data, null, 2)}
                            </pre>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
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
        <Box sx={{ p: 2 }}>
            <Grid container spacing={3}>
                {/* Playground Panel */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <Tabs
                            value={activePanel}
                            onChange={(_, v) => setActivePanel(v)}
                            variant="fullWidth"
                            sx={{ borderBottom: 1, borderColor: 'divider' }}
                        >
                            <Tab label="Inbound Simulator" icon={<Terminal size={16} />} iconPosition="start" />
                            <Tab label="Outbound Real" icon={<Send size={16} />} iconPosition="start" />
                        </Tabs>

                        <Box sx={{ p: 3 }}>
                            {activePanel === 0 ? (
                                <Stack spacing={2}>
                                    <TextField label="Simulated Chat ID" value={simChatId} onChange={(e) => setSimChatId(e.target.value)} fullWidth size="small" />
                                    <TextField label="Simulated User" value={simUser} onChange={(e) => setSimUser(e.target.value)} fullWidth size="small" />
                                    <TextField label="Simulated Message" value={simMessage} onChange={(e) => setSimMessage(e.target.value)} multiline rows={4} fullWidth />
                                    <Button variant="contained" startIcon={<ArrowRightLeft size={18} />} onClick={handleSendSimulation} disabled={isProcessing || !simMessage} fullWidth>
                                        Simulate Webhook
                                    </Button>
                                </Stack>
                            ) : (
                                <Stack spacing={2}>
                                    <TextField label="Target Chat ID" value={realChatId} onChange={(e) => setRealChatId(e.target.value)} fullWidth size="small" />
                                    <TextField label="Actual Message (Markdown)" value={realMessage} onChange={(e) => setRealMessage(e.target.value)} multiline rows={4} fullWidth placeholder="Hello from Admin Dashboard..." />
                                    <Button variant="contained" color="success" startIcon={<Send size={18} />} onClick={handleSendReal} disabled={isProcessing || !realMessage} fullWidth>
                                        Send to Telegram API
                                    </Button>
                                </Stack>
                            )}

                            {status && <Alert severity={status.type} sx={{ mt: 2 }}>{status.message}</Alert>}
                        </Box>
                    </Paper>
                </Grid>

                {/* Logs Table */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ border: '1px solid #e2e8f0' }}>
                        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                            <Stack>
                                <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <MessageSquare size={20} /> System Messages (Live)
                                </Typography>
                                {error && (
                                    <Typography variant="caption" color="error">
                                        Error: {(error as any).message}
                                    </Typography>
                                )}
                            </Stack>
                            <IconButton onClick={() => refetch()} disabled={isLoading}>
                                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                            </IconButton>
                        </Box>
                        <TableContainer sx={{ maxHeight: 650 }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell />
                                        <TableCell>Time</TableCell>
                                        <TableCell>Level</TableCell>
                                        <TableCell>Source</TableCell>
                                        <TableCell>Message</TableCell>
                                        <TableCell>Chat Context</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {logs.length > 0 ? (
                                        logs.map((log: any) => (
                                            <LogRow key={log.id} log={log} onReply={onReply} />
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                                <Typography color="text.secondary">
                                                    {isLoading ? 'Loading fresh messages...' : 'No system messages found.'}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default MessagesTab;
