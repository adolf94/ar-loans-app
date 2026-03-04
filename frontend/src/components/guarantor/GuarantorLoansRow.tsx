import React from 'react';
import { Chip, Stack, TableCell, TableRow, Typography, useMediaQuery, useTheme } from "@mui/material"
import { ArrowRight } from "lucide-react"
import numeral from "numeral"
import { useGetUser } from "../../repositories/user"
import type { Loan } from "../../@types/types"
import dayjs from 'dayjs';

interface GuarantorLoansRowProps {
    loan: Loan;
    onSelect: () => void;
}

const GuarantorLoansRow: React.FC<GuarantorLoansRowProps> = ({ loan, onSelect }) => {

    const user = useGetUser(loan.clientId)
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    if (isMobile) {
        return <TableRow hover onClick={onSelect} sx={{ cursor: 'pointer' }}>
            <TableCell>
                <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={600}>{user?.name || loan?.clientId}</Typography>
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
        </TableRow>
    }

    return <TableRow hover>
        <TableCell>{loan.alternateId}</TableCell>
        <TableCell>{user?.name || loan?.clientId}</TableCell>
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
        </TableCell>
    </TableRow>
}

export default GuarantorLoansRow