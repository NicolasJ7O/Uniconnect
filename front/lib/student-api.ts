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

export async function searchStudents(name: string, page = 1, pageSize = 20, filters: Record<string, any> = {}): Promise<{ results: any[]; total?: number }> {
    const params = { name, page, pageSize, ...filters };
    const res = await apiClient.get<any>('/student/search', { params });
    // backend may return either array or { results, total }
    if (Array.isArray(res.data)) return { results: res.data, total: res.data.length };
    return { results: res.data.results || [], total: res.data.total };
}

export async function getEnrichedStudentProfile(userId: string): Promise<any> {
    const response = await apiClient.get<any>(`/perfil/${userId}?vista=completa`);
    return response.data;
}
