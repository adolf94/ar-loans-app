import React, { useState } from 'react';
import {
    Box, Typography, Button, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, IconButton,
    FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import {
    useGetInterestRules,
    useCreateInterestRule,
    useUpdateInterestRule,
    useDeleteInterestRule
} from '../../repositories/interestRule';
import type { InterestRule } from '../../@types/types';

const InterestRulesTab: React.FC = () => {
    const { data: rules = [], isLoading } = useGetInterestRules();
    const createRule = useCreateInterestRule();
    const updateRule = useUpdateInterestRule();
    const deleteRule = useDeleteInterestRule();

    const [openDialog, setOpenDialog] = useState(false);
    const [editingRule, setEditingRule] = useState<Partial<InterestRule>>({});

    const handleOpenDialog = (rule?: InterestRule) => {
        if (rule) {
            setEditingRule({ ...rule });
        } else {
            setEditingRule({
                name: '',
                interestPerMonth: 10,
                gracePeriodDays: 0,
                gracePeriodInterest: 0,
                latePaymentPenalty: 0,
                defaultTerms: 12,
                interestBase: 'principal' as const
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingRule({});
    };

    const handleSave = async () => {
        if (editingRule.id) {
            await updateRule.mutateAsync(editingRule as InterestRule);
        } else {
            await createRule.mutateAsync(editingRule);
        }
        handleCloseDialog();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this rule?")) {
            await deleteRule.mutateAsync(id);
        }
    };

    if (isLoading) return <Typography>Loading...</Typography>;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h5" fontWeight="bold">Interest Rules (Templates)</Typography>
                <Button
                    variant="contained"
                    startIcon={<Plus size={18} />}
                    onClick={() => handleOpenDialog()}
                >
                    Add Rule
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Interest / Mo</TableCell>
                            <TableCell>Grace Period</TableCell>
                            <TableCell>Grace Period Int.</TableCell>
                            <TableCell>Late Penalty</TableCell>
                            <TableCell>Default Term</TableCell>
                            <TableCell>Interest Base</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rules.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>{r.name}</TableCell>
                                <TableCell>{r.interestPerMonth}%</TableCell>
                                <TableCell>{r.gracePeriodDays} days</TableCell>
                                <TableCell>{r.gracePeriodInterest}%</TableCell>
                                <TableCell>{r.latePaymentPenalty}%</TableCell>
                                <TableCell>{r.defaultTerms} months</TableCell>
                                <TableCell>{r.interestBase === 'balance' ? 'Remaining Balance' : 'Original Principal'}</TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => handleOpenDialog(r)} color="primary">
                                        <Edit2 size={16} />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(r.id)} color="error">
                                        <Trash2 size={16} />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {rules.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} align="center">No rules defined</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingRule.id ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                        <TextField
                            label="Rule Name"
                            value={editingRule.name || ''}
                            onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                            fullWidth
                        />
                        <TextField
                            label="Monthly Interest Rate (%)"
                            type="number"
                            value={editingRule.interestPerMonth ?? ''}
                            onChange={(e) => setEditingRule({ ...editingRule, interestPerMonth: Number(e.target.value) })}
                            fullWidth
                        />
                        <TextField
                            label="Grace Period (Days)"
                            type="number"
                            value={editingRule.gracePeriodDays ?? ''}
                            onChange={(e) => setEditingRule({ ...editingRule, gracePeriodDays: Number(e.target.value) })}
                            fullWidth
                        />
                        <TextField
                            label="Grace Period Interest (%)"
                            type="number"
                            value={editingRule.gracePeriodInterest ?? ''}
                            onChange={(e) => setEditingRule({ ...editingRule, gracePeriodInterest: Number(e.target.value) })}
                            fullWidth
                        />
                        <TextField
                            label="Late Payment Penalty (%)"
                            type="number"
                            value={editingRule.latePaymentPenalty ?? ''}
                            onChange={(e) => setEditingRule({ ...editingRule, latePaymentPenalty: Number(e.target.value) })}
                            fullWidth
                        />
                        <TextField
                            label="Default Terms (Months)"
                            type="number"
                            value={editingRule.defaultTerms ?? ''}
                            onChange={(e) => setEditingRule({ ...editingRule, defaultTerms: Number(e.target.value) })}
                            fullWidth
                        />
                        <FormControl fullWidth>
                            <InputLabel>Interest Computed On</InputLabel>
                            <Select
                                value={editingRule.interestBase || 'principal'}
                                label="Interest Computed On"
                                onChange={(e) => setEditingRule({ ...editingRule, interestBase: e.target.value as 'principal' | 'balance' })}
                            >
                                <MenuItem value="principal">Original Principal</MenuItem>
                                <MenuItem value="balance">Remaining Balance</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={!editingRule.name}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default InterestRulesTab;
