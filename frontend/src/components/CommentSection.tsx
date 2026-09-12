import React, { useEffect, useState, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import type { Comment } from '../repositories/comment';
import { commentRepository } from '../repositories/comment';
import { useGetUser } from '../repositories/user';
import type { User } from '../@types/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Avatar, Spinner, Button } from './ui';

dayjs.extend(relativeTime);

interface CommentSectionProps {
    loanId: string;
}

const CommentItem: React.FC<{ comment: Comment }> = ({ comment }) => {
    const user: User | null = useGetUser(comment.userId);
    const displayName = user?.name || comment.userName || 'Unknown User';

    return (
        <div className="flex gap-3 py-3">
            <Avatar name={displayName} />
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-paper">{displayName}</p>
                    <p className="font-mono text-[11px] text-silverdim whitespace-nowrap">{dayjs(comment.createdAt).fromNow()}</p>
                </div>
                <p className="text-sm text-silver mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
            </div>
        </div>
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
        <div className="mt-2 border border-linestrong rounded-tray bg-bay2/70 p-4">
            <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={16} className="text-silverdim" />
                <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim">Comments ({comments.length})</p>
            </div>

            <div className="flex items-end gap-2">
                <textarea
                    rows={2}
                    placeholder="Add a note or update..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handlePostComment();
                        }
                    }}
                    className="flex-1 bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-silverdim focus:border-amberdeep resize-none"
                />
                <Button
                    variant="amber"
                    startIcon={<Send size={16} />}
                    onClick={handlePostComment}
                    disabled={!newComment.trim() || isPosting}
                    loading={isPosting}
                    aria-label="Send comment"
                    title="Send comment"
                    className="shrink-0"
                />
            </div>

            <div ref={scrollRef} className="mt-3 max-h-[300px] overflow-y-auto pr-1 divide-y divide-line/70">
                {isLoading ? (
                    <div className="py-6 grid place-items-center">
                        <Spinner size={24} />
                    </div>
                ) : comments.length > 0 ? (
                    comments.map((comment) => (
                        <CommentItem key={comment.id} comment={comment} />
                    ))
                ) : (
                    <p className="py-6 text-center text-sm text-silverdim italic">No comments yet.</p>
                )}
            </div>
        </div>
    );
};

export default CommentSection;
