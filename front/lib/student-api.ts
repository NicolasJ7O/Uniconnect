import apiClient from './api-client';

type Subject = {
    id: string;
    name: string;
    code: string | null;
    credits: number | null;
};

export type StudentProfile = {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    career: string | null;
    currentSemester: number | null;
    subjects: Subject[];
};

export type UpdateProfilePayload = {
    career?: string;
    currentSemester?: number;
    subjects?: string[];
};

export async function getStudentProfile(): Promise<StudentProfile> {
    const response = await apiClient.get<StudentProfile>('/student/profile');
    return response.data;
}

export async function updateStudentProfile(data: UpdateProfilePayload): Promise<StudentProfile> {
    const response = await apiClient.put<StudentProfile>('/student/profile', data);
    return response.data;
}

export async function getAllSubjects(): Promise<Subject[]> {
    const response = await apiClient.get<Subject[]>('/student/subjects');
    return response.data;
}

export async function getStudentProfileById(userId: string): Promise<any> {
    const response = await apiClient.get<any>(`/perfil/${userId}`);
    return response.data;
}

export async function searchStudents(name: string): Promise<any[]> {
    const res = await apiClient.get<any[]>('/student/search', { params: { name } });
    return res.data;
}

export async function getEnrichedStudentProfile(userId: string): Promise<any> {
    const response = await apiClient.get<any>(`/perfil/${userId}?vista=completa`);
    return response.data;
}
