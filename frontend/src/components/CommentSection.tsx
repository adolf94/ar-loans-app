import React, { useEffect, useState, useRef } from 'react';
import {
    Box,
    Typography,
    TextField,
    Stack,
    Avatar,
    Paper,
    IconButton,
    CircularProgress,
    Tooltip
} from '@mui/material';
import { Send, MessageSquare } from 'lucide-react';
import type { Comment } from '../repositories/comment';
import { commentRepository } from '../repositories/comment';
import { useGetUser } from '../repositories/user';
import type { User } from '../@types/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface CommentSectionProps {
    loanId: string;
}

const CommentItem: React.FC<{ comment: Comment }> = ({ comment }) => {
    const user: User | null = useGetUser(comment.userId);
    const displayName = user?.name || comment.userName || 'Unknown User';

    return (
        <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Avatar 
                sx={{ 
                    width: 32, 
                    height: 32, 
                    fontSize: '0.875rem',
                    bgcolor: 'primary.light'
                }}
            >
                {displayName.charAt(0)}
            </Avatar>
            <Box sx={{ flex: 1 }}>
                <Paper 
                    elevation={0} 
                    sx={{ 
                        p: 1.5, 
                        bgcolor: 'grey.50', 
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'grey.200'
                    }}
                >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.8rem' }}>
                            {displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {dayjs(comment.createdAt).fromNow()}
                        </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.875rem', color: 'text.primary' }}>
                        {comment.content}
                    </Typography>
                </Paper>
            </Box>
        </Box>
    );
};

const CommentSection: React.FC<CommentSectionProps> = ({ loanId }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchComments = async () => {
        try {
            setIsLoading(true);
            const data = await commentRepository.getCommentsByLoanId(loanId);
            setComments(data);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [loanId]);

    const handlePostComment = async () => {
        if (!newComment.trim()) return;

        try {
            setIsPosting(true);
            await commentRepository.createComment({
                loanId,
                content: newComment.trim()
            });
            setNewComment('');
            await fetchComments();
            // Scroll to top (since they are ordered descending)
            if (scrollRef.current) {
                scrollRef.current.scrollTop = 0;
            }
        } catch (error) {
            console.error('Failed to post comment:', error);
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <MessageSquare size={18} />
                <Typography variant="overline" fontWeight={700} color="text.secondary">
                    Comments ({comments.length})
                </Typography>
            </Stack>

            <Stack spacing={2}>
                {/* Input Area */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Add a note or update..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handlePostComment();
                            }
                        }}
                        multiline
                        maxRows={4}
                        sx={{ 
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                            }
                        }}
                    />
                    <Tooltip title="Send comment">
                        <span>
                            <IconButton 
                                color="primary" 
                                onClick={handlePostComment}
                                disabled={!newComment.trim() || isPosting}
                                sx={{ 
                                    bgcolor: 'primary.main', 
                                    color: 'white',
                                    '&:hover': { bgcolor: 'primary.dark' },
                                    '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
                                    width: 40,
                                    height: 40,
                                    alignSelf: 'flex-end'
                                }}
                            >
                                {isPosting ? <CircularProgress size={20} color="inherit" /> : <Send size={18} />}
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>

                {/* Comments List */}
                <Box 
                    ref={scrollRef}
                    sx={{ 
                        maxHeight: 300, 
                        overflowY: 'auto',
                        pr: 1,
                        '&::-webkit-scrollbar': { width: 4 },
                        '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                        '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 4 }
                    }}
                >
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : comments.length > 0 ? (
                        <Stack spacing={2}>
                            {comments.map((comment) => (
                                <CommentItem key={comment.id} comment={comment} />
                            ))}
                        </Stack>
                    ) : (
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                No comments yet.
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Stack>
        </Box>
    );
};

export default CommentSection;
