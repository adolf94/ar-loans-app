import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "../@types/types";
import api from "../services/api";




export const getUsers = async (): Promise<User[]> => {
    const { data } = await api.get<User[]>('/users');
    return data;
};




export const useGetUser = (id: string)  => {
    const {data = null} = useQuery({
        queryKey: ["users", {userId:id}], 
            queryFn:()=>api.get(`/users/${id}`)
                .then(e=>e.data)
         })
    return data
};


export const createUser = async (user: Partial<User>): Promise<User> => {
    const { data } = await api.post<User>('/users', user);
    return data;
};

export const updateUser = async (id: string, user: Partial<User>): Promise<User> => {
    const { data } = await api.put<User>(`/users/${id}`, user);
    return data;
};

// Hooks
export const useUsers = () => {
    return useQuery({
        queryKey: ['users'],
        queryFn: getUsers,
    });
};



export const useCreateUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });
};

export const useUpdateUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, user }: { id: string; user: Partial<User> }) => updateUser(id, user),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });
};
