import apiClient from "../services/api";

export interface Comment {
    id: string;
    loanId: string;
    userId: string;
    userName: string;
    content: string;
    createdAt: string;
    partitionKey: string;
}

export const commentRepository = {
    async createComment(comment: Partial<Comment>): Promise<Comment> {
        const response = await apiClient.post<Comment>('/comments', comment);
        return response.data;
    },

    async getCommentsByLoanId(loanId: string): Promise<Comment[]> {
        const response = await apiClient.get<Comment[]>(`/loans/${loanId}/comments`);
        return response.data;
    }
};
