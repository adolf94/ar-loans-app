import React from 'react';
import { Chip, Stack, TableCell, TableRow, Typography, useMediaQuery, useTheme, IconButton, Tooltip } from "@mui/material"
import { ArrowRight, Link as LinkIcon } from "lucide-react"
import numeral from "numeral"
import { useGetUser } from "../../repositories/user"
import type { Loan } from "../../@types/types"
import dayjs from 'dayjs';
import { Link } from '@tanstack/react-router';
import MagicLinkDialog from '../dialogs/MagicLinkDialog';

interface GuarantorLoansRowProps {
    loan: Loan;
    onSelect: () => void;
}

const GuarantorLoansRow: React.FC<GuarantorLoansRowProps> = ({ loan, onSelect }) => {

    const user = useGetUser(loan.clientId)
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [magicLinkDialogOpen, setMagicLinkDialogOpen] = React.useState(false);

    if (isMobile) {
        return <TableRow hover onClick={onSelect} sx={{ cursor: 'pointer' }}>
            <TableCell>
                <Stack spacing={0.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                            variant="body2"
                            fontWeight={600}
                            component={Link}
                            to={`/client-statement/${loan.clientId}`}
                            sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                            {user?.name || loan?.clientId}
                        </Typography>
                        {user && !user.oidcUid && (
                            <IconButton 
                                size="small" 
                                color="primary" 
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setMagicLinkDialogOpen(true); }}
                                sx={{ p: 0.5 }}
                            >
                                <LinkIcon size={12} />
                            </IconButton>
                        )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{loan.alternateId}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {dayjs(loan.date).format("MMM DD")}
                    </Typography>
                </Stack>
            </TableCell>
            <TableCell>
                <Stack spacing={0.25} alignItems="flex-end">
                    <Typography variant="body2" fontWeight={600} color="error.main">
                        {numeral(loan.balance).format("0,0.00")}
                    </Typography>
                    <Chip
                        label={loan.status}
                        size="small"
                        color={loan.status === 'Active' ? 'warning' : 'success'}
                        variant="outlined"
                        sx={{ fontWeight: 700, height: 18, fontSize: '0.6rem' }}
                    />
                </Stack>
            </TableCell>
            {user && (
                <MagicLinkDialog
                    open={magicLinkDialogOpen}
                    onClose={() => setMagicLinkDialogOpen(false)}
                    userId={user.id}
                    userName={user.name}
                />
            )}
        </TableRow>
    }

    return <TableRow hover>
        <TableCell>{loan.alternateId}</TableCell>
        <TableCell>
            <Stack direction="row" spacing={1} alignItems="center">
                <Typography
                    variant="body2"
                    fontWeight={600}
                    component={Link}
                    to={`/client-statement/${loan.clientId}`}
                    sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                    {user?.name || loan?.clientId}
                </Typography>
                {user && !user.oidcUid && (
                    <Tooltip title="Link OIDC Account">
                        <IconButton 
                            size="small" 
                            color="primary" 
                            onClick={() => setMagicLinkDialogOpen(true)}
                            sx={{ p: 0.5 }}
                        >
                            <LinkIcon size={14} />
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>
        </TableCell>
        <TableCell>${loan.principal.toLocaleString()}</TableCell>
        <TableCell sx={{ color: 'error.main', fontWeight: 600 }}>
            {numeral(loan.balance).format("0,0.00")}
        </TableCell>
        <TableCell>
            <Chip
                label={loan.status}
                size="small"
                color={loan.status === 'Active' ? 'warning' : 'success'}
                variant="outlined"
                sx={{ fontWeight: 700 }}
            />
        </TableCell>
        <TableCell align="right">
            <ArrowRight
                size={18}
                style={{ cursor: 'pointer', opacity: 0.5 }}
                onClick={onSelect}
            />
            {user && (
                <MagicLinkDialog
                    open={magicLinkDialogOpen}
                    onClose={() => setMagicLinkDialogOpen(false)}
                    userId={user.id}
                    userName={user.name}
                />
            )}
        </TableCell>
    </TableRow>
}

export default GuarantorLoansRow