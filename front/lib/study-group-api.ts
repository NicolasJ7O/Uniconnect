import apiClient from './api-client';
import { Platform } from 'react-native';

export type StudyGroupMember = {
    id: string;
    name: string | null;
    email: string;
    career?: string | null;
    currentSemester?: number | null;
};

export type StudyGroupOwner = {
    id: string;
    name: string | null;
    email: string;
};

export type StudyGroupResource = {
    id: string;
    groupId: string;
    uploaderId: string;
    title: string;
    type: 'PDF' | 'LINK';
    url: string;
    createdAt: string;
};

export type StudyGroup = {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    owner: StudyGroupOwner;
    members: StudyGroupMember[];
    resources?: StudyGroupResource[];
    createdAt: string;
    updatedAt: string;
};

export async function getStudentStudyGroups(studentId: string): Promise<StudyGroup[]> {
    const response = await apiClient.get<StudyGroup[]>(`/groups/student/${studentId}`);
    return response.data;
}

export async function createStudyGroup(data: { name: string; description?: string; subjectId?: string }): Promise<StudyGroup> {
    const response = await apiClient.post<StudyGroup>('/groups', data);
    return response.data;
}

export async function updateStudyGroup(groupId: string, data: { name?: string; description?: string }): Promise<StudyGroup> {
    const response = await apiClient.put<StudyGroup>(`/groups/${groupId}`, data);
    return response.data;
}

export async function addMembersToStudyGroup(groupId: string, memberIds: string[]): Promise<StudyGroup> {
    const response = await apiClient.post<StudyGroup>(`/groups/${groupId}/members`, { memberIds });
    return response.data;
}

export async function searchStudentsByName(query: string): Promise<StudyGroupMember[]> {
    const response = await apiClient.get<StudyGroupMember[]>(`/student/search?name=${encodeURIComponent(query)}`);
    return response.data;
}

export async function deleteStudyGroup(groupId: string): Promise<void> {
    await apiClient.delete(`/groups/${groupId}`);
}

export async function removeMemberFromStudyGroup(groupId: string, memberId: string, newOwnerId?: string): Promise<StudyGroup> {
    const response = await apiClient.delete<StudyGroup>(`/groups/${groupId}/members/${memberId}`, {
        data: { newOwnerId }
    });
    return response.data;
}

export async function getStudyGroupResources(groupId: string): Promise<StudyGroupResource[]> {
    const response = await apiClient.get<StudyGroupResource[]>(`/groups/${groupId}/resources`);
    return response.data;
}

export async function addStudyGroupResource(groupId: string, formData: FormData): Promise<StudyGroupResource> {
    const response = await apiClient.post<StudyGroupResource>(`/groups/${groupId}/resources`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        }
    });
    return response.data;
}

export async function deleteStudyGroupResource(groupId: string, resourceId: string): Promise<void> {
    await apiClient.delete(`/groups/${groupId}/resources/${resourceId}`);
}

// ==== STUDY GROUP REQUESTS OVER NETWORK ====

export type StudyGroupRequest = {
    id: string;
    groupId: string;
    userId: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    createdAt: string;
    user?: StudyGroupMember;
}

export async function getDiscoverableStudyGroups(): Promise<StudyGroup[]> {
    const response = await apiClient.get<StudyGroup[]>('/groups/discover');
    return response.data;
}

export async function requestJoinGroup(groupId: string): Promise<StudyGroupRequest> {
    const response = await apiClient.post<StudyGroupRequest>(`/groups/${groupId}/requests`);
    return response.data;
}

export async function getGroupRequests(groupId: string): Promise<StudyGroupRequest[]> {
    const response = await apiClient.get<StudyGroupRequest[]>(`/groups/${groupId}/requests`);
    return response.data;
}

export async function respondToGroupRequest(groupId: string, requestId: string, status: 'ACCEPTED' | 'REJECTED'): Promise<StudyGroupRequest> {
    const response = await apiClient.put<StudyGroupRequest>(`/groups/${groupId}/requests/${requestId}`, { status });
    return response.data;
}

export async function resendGroupRequest(groupId: string): Promise<StudyGroupRequest> {
    const response = await apiClient.post<StudyGroupRequest>(`/groups/${groupId}/requests`);
    return response.data;
}

export async function getStudyGroupById(groupId: string): Promise<StudyGroup> {
    const response = await apiClient.get<StudyGroup>(`/groups/${groupId}`);
    return response.data;
}

export async function transferGroupOwnership(groupId: string, newOwnerId: string): Promise<StudyGroup> {
    const response = await apiClient.put<StudyGroup>(`/groups/${groupId}/transfer-ownership`, { newOwnerId });
    return response.data;
}

export async function leaveStudyGroup(groupId: string): Promise<{ left?: boolean; deleted?: boolean }> {
    const response = await apiClient.delete<{ left?: boolean; deleted?: boolean }>(`/groups/${groupId}/leave`);
    return response.data;
}

export async function requestOwnershipTransfer(groupId: string, newOwnerId: string): Promise<any> {
    const response = await apiClient.post(`/groups/${groupId}/transfer-request`, { newOwnerId });
    return response.data;
}

export async function getPendingOwnershipTransfers(): Promise<any[]> {
    const response = await apiClient.get('/groups/transfers/pending');
    return response.data;
}

export async function respondToOwnershipTransfer(groupId: string, requestId: string, accept: boolean): Promise<any> {
    const response = await apiClient.post(`/groups/${groupId}/transfer-response/${requestId}`, { accept });
    return response.data;
}
