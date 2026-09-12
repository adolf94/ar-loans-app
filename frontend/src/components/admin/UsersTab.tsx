import React from 'react';
import { Edit2, FileText, Link as LinkIcon } from 'lucide-react';
import { useUsers } from '../../repositories/user';
import { Link } from '@tanstack/react-router';
import MagicLinkDialog from '../dialogs/MagicLinkDialog';
import { Button, Stamp, Skeleton, Panel } from '../ui';

interface UsersTabProps {
    onEditUser: (userId: string) => void;
}

const UsersTab: React.FC<UsersTabProps> = ({ onEditUser }) => {
    const { data: users = [], isLoading } = useUsers()

    const [magicLinkDialog, setMagicLinkDialog] = React.useState({
        open: false,
        userId: '',
        userName: ''
    });

    return (
        <div className="max-h-[calc(100vh-300px)] overflow-x-auto">
            <Panel pad={false} className="min-w-[560px] overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim border-b border-linestrong">
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Role</th>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Mobile</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line/70">
                        {isLoading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i}>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                                    <td className="px-4 py-3"><Skeleton className="h-6 w-20" /></td>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <Skeleton className="h-4 w-16" />
                                            <Skeleton className="h-4 w-10" />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : users.map((user) => (
                            <tr key={user.id} className="hover:bg-tray/50 transition-colors">
                                <td className="px-4 py-3 text-paper font-semibold">{user.name}</td>
                                <td className="px-4 py-3">
                                    <Stamp tone={user.oidcUid ? 'good' : 'silver'} dashed={!user.oidcUid}>{user.role}</Stamp>
                                </td>
                                <td className="px-4 py-3 text-silver">{user.email}</td>
                                <td className="px-4 py-3 font-mono text-silverdim">{user.mobileNumber || '—'}</td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1">
                                        {!user.oidcUid && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                startIcon={<LinkIcon size={14} strokeWidth={1.7} />}
                                                onClick={() => setMagicLinkDialog({ open: true, userId: user.id, userName: user.name })}
                                            >
                                                Link
                                            </Button>
                                        )}
                                        <Link
                                            to="/client-statement/$clientId"
                                            params={{ clientId: user.id }}
                                            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-silver hover:text-paper hover:bg-tray/70 transition-colors"
                                        >
                                            <FileText size={14} strokeWidth={1.7} />
                                            Statement
                                        </Link>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            startIcon={<Edit2 size={14} strokeWidth={1.7} />}
                                            onClick={() => onEditUser(user.id)}
                                        >
                                            Edit
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!isLoading && users.length === 0 && (
                    <div className="border border-dashed border-linestrong rounded-tray m-4 p-6 text-center text-sm text-silverdim">
                        No users on the wall yet.
                    </div>
                )}
            </Panel>
            <MagicLinkDialog
                open={magicLinkDialog.open}
                onClose={() => setMagicLinkDialog({ ...magicLinkDialog, open: false })}
                userId={magicLinkDialog.userId}
                userName={magicLinkDialog.userName}
            />
        </div>
    );
};

export default UsersTab;
