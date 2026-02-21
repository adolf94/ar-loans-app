import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Chip,
    useMediaQuery,
    useTheme
} from '@mui/material';
import { Edit2 } from 'lucide-react';
import type { User } from '../../@types/types';
import { useUsers } from '../../repositories/user';

interface UsersTabProps {
    onEditUser: (userId: string) => void;
}

const UsersTab: React.FC<UsersTabProps> = ({  onEditUser }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const {data : users = []} = useUsers()

    return (
        <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)', overflowX: 'auto' }}>
            <Table stickyHeader size={isMobile ? 'small' : 'medium'}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Role</TableCell>
                        {!isMobile && <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>Email</TableCell>}
                        {!isMobile && <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Mobile</TableCell>}
                        <TableCell align="right" sx={{ fontWeight: 700, minWidth: 100 }}>Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {users.map((user) => (
                        <TableRow key={user.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{user.name}</TableCell>
                            <TableCell>
                                <Chip label={user.role} size="small" variant="outlined" />
                            </TableCell>
                            {!isMobile && <TableCell>{user.email}</TableCell>}
                            {!isMobile && <TableCell>{user.mobileNumber || '-'}</TableCell>}
                            <TableCell align="right">
                                <Button
                                    size="small"
                                    variant="text"
                                    startIcon={<Edit2 size={14} />}
                                    onClick={() => onEditUser(user.id)}
                                >
                                    Edit
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default UsersTab;
