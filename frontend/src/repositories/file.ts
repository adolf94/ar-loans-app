import api from "../services/api";

export interface IdentifiedTransaction {
    transactionType: string;
    app: string;
    description: string;
    sourceFilename: string;
    reference: string;
    datetime: string;
    senderAcct: string;
    senderBank: string;
    senderName: string;
    recipientAcct: string;
    recipientBank: string;
    recipientName: string;
    amount: number;
    fileId: string,
    transactionFee: number;
}

export const identifyTransaction = async (file: File): Promise<IdentifiedTransaction> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post<IdentifiedTransaction>('/files/identify_transaction', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });

    return data;
};
