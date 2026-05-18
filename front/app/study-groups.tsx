import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View, Modal, Platform, Alert, TouchableOpacity, KeyboardAvoidingView, FlatList } from 'react-native';
import { useToast } from '@/components/Toast';
import { Stack, router, useFocusEffect } from 'expo-router';
import { loadSession, type SessionData } from '@/lib/session';
import apiClient from '@/lib/api-client';
import {
    getStudentStudyGroups,
    createStudyGroup,
    updateStudyGroup,
    addMembersToStudyGroup,
    removeMemberFromStudyGroup,
    searchStudentsByName,
    deleteStudyGroup,
    getDiscoverableStudyGroups,
    requestJoinGroup,
    getGroupRequests,
    respondToGroupRequest,
    transferGroupOwnership,
    leaveStudyGroup,
    requestOwnershipTransfer,
    type StudyGroup,
    type StudyGroupMember,
    type StudyGroupRequest
} from '@/lib/study-group-api';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useNotifications } from '@/context/NotificationContext';

export default function StudyGroupsScreen() {
    const { showToast } = useToast();
    const [session, setSession] = useState<SessionData | null>(null);
    const [groups, setGroups] = useState<StudyGroup[]>([]);

    // Tab State
    const [activeTab, setActiveTab] = useState<'mine' | 'discover'>('mine');
    const [discoverGroups, setDiscoverGroups] = useState<StudyGroup[]>([]);
    const [isDiscoverLoading, setIsDiscoverLoading] = useState(false);

    // Group requests state
    const [groupRequests, setGroupRequests] = useState<StudyGroupRequest[]>([]);
    const [isRequestingMap, setIsRequestingMap] = useState<Record<string, boolean>>({});

    const [isLoading, setIsLoading] = useState(true);

    const [isCreateModalVisible, setCreateModalVisible] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [subjectSearch, setSubjectSearch] = useState('');

    // Edit state
    const [editingGroup, setEditingGroup] = useState<StudyGroup | null>(null);
    const [showAllMembers, setShowAllMembers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<StudyGroupMember[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isRemovingMember, setIsRemovingMember] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [selectedNewOwner, setSelectedNewOwner] = useState<string | null>(null);
    const [isLeavingGroup, setIsLeavingGroup] = useState(false);
    const [isWaitingTransfer, setIsWaitingTransfer] = useState(false);
    const { socket } = useNotifications();

    // Group info edit state
    const [editInfoName, setEditInfoName] = useState('');
    const [editInfoDesc, setEditInfoDesc] = useState('');
    const [isUpdatingInfo, setIsUpdatingInfo] = useState(false);

    // Profile Modal State
    const [selectedMember, setSelectedMember] = useState<StudyGroupMember | null>(null);

    const isGroupOwner = useCallback((user: SessionData['user'] | undefined | null, group: StudyGroup | undefined | null) => {
        if (!user || !group) return false;

        // 1. Exact ID match
        if (group.ownerId === user.id) return true;

        // 2. Exact email match (useful if they log in via different providers)
        if (group.owner?.email && user.email) {
            if (group.owner.email.toLowerCase().trim() === user.email.toLowerCase().trim()) return true;
        }

        // 3. Weak fallback: if ID is an auth0 ID and the backend CUID matches their profile
        if (group.owner?.id === user.id) return true;
        if (user.id.includes(group.ownerId) || group.ownerId.includes(user.id.replace('auth0|', ''))) return true;

        // 4. Sometimes email is missing in user session, fallback to name match if owner name is present
        if (group.owner?.name && user.name) {
            if (group.owner.name.toLowerCase().trim() === user.name.toLowerCase().trim()) return true;
        }

        return false;
    }, []); useFocusEffect(
        useCallback(() => {
            async function fetchGroups() {
                try {
                    const currentSession = await loadSession();
                    if (!currentSession) {
                        router.replace('/');
                        return;
                    }
                    setSession(currentSession);
                    const data = await getStudentStudyGroups(currentSession.user.id);
                    setGroups(data);
                } catch (error) {
                    console.error('Failed to load groups', error);
                } finally {
                    setIsLoading(false);
                }
            }
            fetchGroups();
        }, [])
    );

    const fetchSubjects = useCallback(async () => {
        try {
            const res = await apiClient.get<{ id: string; name: string }[]>('/student/subjects');
            setSubjects(res.data);
        } catch (e) {
            console.error('Error fetching subjects', e);
        }
    }, []);

    useEffect(() => {
        if (isCreateModalVisible) fetchSubjects();
    }, [isCreateModalVisible, fetchSubjects]);

    const handleCreateGroup = async () => {
        const trimmedName = newGroupName.trim();
        if (!trimmedName) return;

        if (trimmedName.length < 3) {
            showToast('El nombre del grupo debe tener al menos 3 caracteres', 'error');
            return;
        }

        try {
            setIsCreating(true);
            const created = await createStudyGroup({
                name: trimmedName,
                description: newGroupDesc.trim() || undefined,
                subjectId: selectedSubjectId || undefined,
            });
            setGroups([created, ...groups]);
            setCreateModalVisible(false);
            setNewGroupName('');
            setNewGroupDesc('');
            setSelectedSubjectId(null);
            setSubjectSearch('');
            showToast('Grupo creado con éxito', 'success');
        } catch (error: any) {
            console.error('Error creating group', error);
            const msg = error?.response?.data?.message;
            if (msg) showToast(msg, 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        try {
            setIsSearching(true);
            const results = await searchStudentsByName(searchQuery.trim());
            // Filter out existing members (very basic filter)
            if (editingGroup) {
                const memberIds = new Set(editingGroup.members.map(m => m.id));
                setSearchResults(results.filter(r => !memberIds.has(r.id)));
            } else {
                setSearchResults(results);
            }
        } catch (error) {
            console.error('Search error', error);
            showToast('Error al buscar estudiantes', 'error');
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddMember = async (memberId: string) => {
        if (!editingGroup) return;
        try {
            setIsAddingMember(true);
            const updatedGroup = await addMembersToStudyGroup(editingGroup.id, [memberId]);
            setEditingGroup(updatedGroup);
            setGroups(groups.map(g => (g.id === updatedGroup.id ? updatedGroup : g)));
            setSearchResults(searchResults.filter(r => r.id !== memberId));
            showToast('Estudiante añadido', 'success');
        } catch (error) {
            console.error('Add member error', error);
            showToast('Error al añadir miembro', 'error');
        } finally {
            setIsAddingMember(false);
        }
    };

    const handleRemoveMember = async (memberId: string, memberName: string) => {
        if (!editingGroup) return;

        const performRemove = async () => {
            try {
                setIsRemovingMember(memberId);
                const updatedGroup = await removeMemberFromStudyGroup(editingGroup.id, memberId);
                setEditingGroup(updatedGroup);
                setGroups(groups.map(g => (g.id === updatedGroup.id ? updatedGroup : g)));
                showToast('Miembro eliminado', 'success');
            } catch (error) {
                console.error('Remove member error', error);
                showToast('No se pudo eliminar al miembro', 'error');
            } finally {
                setIsRemovingMember(null);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`¿Seguro que deseas eliminar a ${memberName} del grupo?`)) {
                void performRemove();
            }
        } else {
            // Keep Alert for confirmation since it's a destructive action
            Alert.alert(
                'Eliminar miembro',
                `¿Seguro que deseas eliminar a ${memberName} del grupo?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => void performRemove() },
                ]
            );
        }
    };

    const handleDeleteGroup = async () => {
        if (!editingGroup) return;

        const performDelete = async () => {
            try {
                setIsDeleting(true);
                await deleteStudyGroup(editingGroup.id);
                setGroups(groups.filter(g => g.id !== editingGroup.id));
                setEditingGroup(null);
                showToast('El grupo ha sido eliminado', 'success');
            } catch (error) {
                console.error('Delete group error', error);
                showToast('No se pudo eliminar el grupo', 'error');
            } finally {
                setIsDeleting(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`¿Estás seguro de que deseas eliminar el grupo "${editingGroup.name}"? Esta acción no se puede deshacer.`)) {
                void performDelete();
            }
        } else {
            // Keep Alert for confirmation
            Alert.alert(
                'Eliminar Grupo',
                `¿Estás seguro de que deseas eliminar el grupo "${editingGroup.name}"? Esta acción no se puede deshacer.`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => void performDelete() },
                ]
            );
        }
    };

    const handleLeaveGroup = async () => {
        if (!editingGroup) return;

        const performLeave = async () => {
            try {
                setIsLeavingGroup(true);
                const result = await leaveStudyGroup(editingGroup.id);
                if (result.left || result.deleted) {
                    setGroups(groups.filter(g => g.id !== editingGroup.id));
                    setEditingGroup(null);
                    showToast('Has abandonado el grupo', 'success');
                }
            } catch (error) {
                console.error('Leave group error', error);
                showToast('No se pudo abandonar el grupo', 'error');
            } finally {
                setIsLeavingGroup(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`¿Estás seguro de que deseas abandonar el grupo "${editingGroup.name}"?`)) {
                void performLeave();
            }
        } else {
            Alert.alert(
                'Abandonar Grupo',
                `¿Estás seguro de que deseas abandonar el grupo "${editingGroup.name}"?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Abandonar', style: 'destructive', onPress: () => void performLeave() },
                ]
            );
        }
    };

    useEffect(() => {
        if (!socket || !editingGroup) return;

        const onTransferAccepted = (data: any) => {
            if (editingGroup && data.groupId === editingGroup.id) {
                setGroups(prev => prev.filter(g => g.id !== editingGroup.id));
                setEditingGroup(null);
                setShowTransferModal(false);
                setIsWaitingTransfer(false);
                setIsLeavingGroup(false);
                showToast(`Has dejado el grupo "${data.groupName}" correctamente`, 'success');
                
                // Force navigation back to dashboard to ensure the user is "out"
                router.replace('/dashboard');
            }
        };

        const onTransferRejected = (data: any) => {
            if (data.groupId === editingGroup.id) {
                setIsWaitingTransfer(false);
                setIsLeavingGroup(false);
            }
        };

        socket.on('ownership-transfer-accepted', onTransferAccepted);
        socket.on('ownership-transfer-rejected', onTransferRejected);

        return () => {
            socket.off('ownership-transfer-accepted', onTransferAccepted);
            socket.off('ownership-transfer-rejected', onTransferRejected);
        };
    }, [socket, editingGroup]);

    const handleTransferAndLeave = async () => {
        if (!editingGroup || !selectedNewOwner) return;

        try {
            setIsLeavingGroup(true);
            setIsWaitingTransfer(true);
            
            // Phase 1: Request transfer
            await requestOwnershipTransfer(editingGroup.id, selectedNewOwner);
            
            setShowTransferModal(false);
            setSelectedNewOwner(null);
            
            showToast('Invitación enviada. Esperando aceptación...', 'info');
            // The actual exit will be handled by the socket listener
        } catch (error) {
            console.error('Transfer and leave error', error);
            showToast('Ocurrió un error al enviar la invitación', 'error');
            setIsLeavingGroup(false);
            setIsWaitingTransfer(false);
        }
    };

    const handleUpdateGroupInfo = async () => {
        if (!editingGroup || !editInfoName.trim()) return;
        try {
            setIsUpdatingInfo(true);
            const updated = await updateStudyGroup(editingGroup.id, {
                name: editInfoName.trim(),
                description: editInfoDesc.trim(),
            });
            setEditingGroup(updated);
            setGroups(groups.map(g => (g.id === updated.id ? updated : g)));
            showToast('Información del grupo actualizada', 'success');
        } catch (error) {
            console.error('Update group info error', error);
            showToast('No se pudo actualizar la información del grupo', 'error');
        } finally {
            setIsUpdatingInfo(false);
        }
    };

    const handleTabChange = async (tab: 'mine' | 'discover') => {
        setActiveTab(tab);
        if (tab === 'discover' && discoverGroups.length === 0) {
            // Only fetch discoverable groups if we don't have them loaded
            setIsDiscoverLoading(true);
            try {
                const discovered = await getDiscoverableStudyGroups();
                setDiscoverGroups(discovered);
            } catch (error) {
                console.error('Error fetching discoverable groups', error);
                showToast('Error al cargar grupos descubiertos', 'error');
            } finally {
                setIsDiscoverLoading(false);
            }
        }
    };

    const handleJoinRequest = async (groupId: string) => {
        if (!session) return;
        try {
            setIsRequestingMap(prev => ({ ...prev, [groupId]: true }));
            await requestJoinGroup(groupId);
            showToast('Solicitud de unión enviada', 'success');
        } catch (error) {
            console.error('Error sending join request', error);
            showToast('Error al enviar solicitud', 'error');
        } finally {
            setIsRequestingMap(prev => ({ ...prev, [groupId]: false }));
        }
    };

    const fetchGroupRequests = useCallback(async (groupId: string) => {
        if (!session) return;
        try {
            const requests = await getGroupRequests(groupId);
            setGroupRequests(requests);
        } catch (error) {
            console.error('Error fetching group requests', error);
        }
    }, [session]);

    const handleRespondToRequest = async (requestId: string, accept: boolean) => {
        if (!editingGroup) return;
        try {
            await respondToGroupRequest(editingGroup.id, requestId, accept ? 'ACCEPTED' : 'REJECTED');
            showToast(accept ? 'Solicitud aceptada' : 'Solicitud rechazada', 'success');
            // Refresh requests & group info
            fetchGroupRequests(editingGroup.id);
            // Optionally, refresh members if accepted...
            if (accept) {
                const refreshedGroups = await getStudentStudyGroups(session!.user.id);
                setGroups(refreshedGroups);
                const updatedGroup = refreshedGroups.find(g => g.id === editingGroup.id);
                if (updatedGroup) setEditingGroup(updatedGroup);
            }
        } catch (error) {
            console.error('Error responding to request', error);
            showToast('Error al responder la solicitud', 'error');
        }
    };

    useEffect(() => {
        if (editingGroup && session && isGroupOwner(session.user, editingGroup)) {
            fetchGroupRequests(editingGroup.id);
        }
    }, [editingGroup, session, fetchGroupRequests, isGroupOwner]);

    const renderProfileModal = () => (
        <Modal
            visible={!!selectedMember}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setSelectedMember(null)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Perfil de Estudiante</Text>
                        <TouchableOpacity onPress={() => setSelectedMember(null)} style={styles.closeIcon}>
                            <Ionicons name="close" size={24} color={Colors.light.text} />
                        </TouchableOpacity>
                    </View>

                    {selectedMember && (
                        <View style={styles.profileDetails}>
                            <View style={styles.profileAvatar}>
                                <Text style={styles.profileAvatarText}>
                                    {selectedMember.name ? selectedMember.name.charAt(0).toUpperCase() : '?'}
                                </Text>
                            </View>
                            <Text style={styles.profileName}>{selectedMember.name}</Text>
                            <Text style={styles.profileEmail}>{selectedMember.email}</Text>

                            <View style={styles.profileInfoBox}>
                                <View style={styles.profileInfoRow}>
                                    <Ionicons name="book-outline" size={20} color={Colors.light.tabIconDefault} />
                                    <Text style={styles.profileInfoText}>
                                        Carrera: <Text style={styles.profileInfoValue}>{selectedMember.career || 'No especificada'}</Text>
                                    </Text>
                                </View>
                                <View style={styles.profileInfoRow}>
                                    <Ionicons name="time-outline" size={20} color={Colors.light.tabIconDefault} />
                                    <Text style={styles.profileInfoText}>
                                        Semestre: <Text style={styles.profileInfoValue}>{selectedMember.currentSemester || 'No especificado'}</Text>
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                        <Pressable
                            style={[styles.modalButton, styles.cancelModalButton]}
                            onPress={() => setSelectedMember(null)}
                        >
                            <Text style={styles.cancelModalButtonText}>Cerrar</Text>
                        </Pressable>
                        {session?.user?.id !== selectedMember?.id && (
                            <Pressable
                                style={[styles.modalButton, { backgroundColor: '#1d4ed8' }]}
                                onPress={() => {
                                    const memberId = selectedMember?.id;
                                    const memberName = selectedMember?.name;
                                    setSelectedMember(null);
                                    if (memberId) {
                                        router.push({ pathname: '/private-chat', params: { id: memberId, name: memberName } } as any);
                                    }
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Mensaje Privado</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );

    if (isLoading || !session) {
        return (
            <View style={styles.loaderContainer}>
                <Stack.Screen options={{ title: 'Grupos de Estudio' }} />
                <ActivityIndicator />
                <Text style={styles.loaderText}>Cargando grupos...</Text>
            </View>
        );
    }

    if (editingGroup) {
        // Edit mode UI
        return (
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={Keyboard.dismiss}
            >
                <Pressable onPress={() => { setEditingGroup(null); setSearchQuery(''); setSearchResults([]); }} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Volver a mis grupos</Text>
                </Pressable>

                {session && isGroupOwner(session.user, editingGroup) ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Información del Grupo</Text>
                        <Text style={styles.label}>Nombre</Text>
                        <TextInput
                            style={styles.input}
                            value={editInfoName}
                            onChangeText={setEditInfoName}
                            placeholder="Nombre del grupo"
                        />
                        <Text style={styles.label}>Descripción</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={editInfoDesc}
                            onChangeText={setEditInfoDesc}
                            placeholder="Descripción del grupo"
                            multiline
                        />
                        <Pressable
                            style={[styles.modalButton, styles.saveModalButton, { backgroundColor: '#003e70' }, isUpdatingInfo && { opacity: 0.6 }]}
                            onPress={handleUpdateGroupInfo}
                            disabled={isUpdatingInfo}
                        >
                            <Text style={styles.saveModalButtonText}>
                                {isUpdatingInfo ? 'Guardando...' : 'Guardar Cambios'}
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <Text style={styles.title}>Gestionar: {editingGroup.name}</Text>
                        <Text style={styles.subtitle}>{editingGroup.description || 'Sin descripción'}</Text>
                    </>
                )}

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Miembros actuales ({editingGroup.members.length})</Text>
                    {editingGroup.members.map((member) => (
                        <View
                            key={member.id}
                            style={styles.memberItem}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.memberName}>{member.name || member.email}</Text>
                                    <Text style={styles.memberCareer}>{member.career || 'Sin carrera'} • Semestre {member.currentSemester || '?'}</Text>
                                    {member.id === editingGroup.ownerId ? (
                                        <View style={styles.ownerBadge}><Text style={styles.ownerBadgeText}>Administrador</Text></View>
                                    ) : null}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <TouchableOpacity onPress={() => setSelectedMember(member)} style={styles.viewProfileButton}>
                                        <Ionicons name="person-circle-outline" size={28} color={Colors.light.tint} />
                                    </TouchableOpacity>

                                    {session && isGroupOwner(session.user, editingGroup) && member.id !== editingGroup.ownerId && (
                                        <Pressable
                                            onPress={() => handleRemoveMember(member.id, member.name || member.email)}
                                            disabled={isRemovingMember === member.id}
                                            style={styles.removeMemberButton}
                                        >
                                            <Text style={styles.removeMemberButtonText}>
                                                {isRemovingMember === member.id ? '...' : 'Eliminar'}
                                            </Text>
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                {session && isGroupOwner(session.user, editingGroup) && groupRequests.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Solicitudes de unión ({groupRequests.length})</Text>
                        {groupRequests.map((request) => (
                            <View key={request.id} style={styles.memberItem}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.memberName}>{request.user?.name || request.user?.email || 'Usuario'}</Text>
                                        <Text style={styles.memberCareer}>
                                            {request.user?.career || 'Sin carrera'} • Semestre {request.user?.currentSemester || '?'}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>Status: {request.status}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <Pressable
                                            onPress={() => handleRespondToRequest(request.id, true)}
                                            style={[styles.addButton, { backgroundColor: '#10b981' }]}
                                        >
                                            <Text style={styles.addButtonText}>Aceptar</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => handleRespondToRequest(request.id, false)}
                                            style={[styles.addButton, { backgroundColor: '#ef4444' }]}
                                        >
                                            <Text style={styles.addButtonText}>Rechazar</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {session && isGroupOwner(session.user, editingGroup) && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Añadir estudiantes</Text>
                        <View style={styles.searchRow}>
                            <TextInput
                                style={[styles.input, styles.flexInput]}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Buscar por nombre..."
                                placeholderTextColor="#94a3b8"
                                onSubmitEditing={handleSearch}
                            />
                            <Pressable style={styles.searchButton} onPress={handleSearch} disabled={isSearching}>
                                <Text style={styles.searchButtonText}>{isSearching ? '...' : 'Buscar'}</Text>
                            </Pressable>
                        </View>

                        {searchResults.length > 0 && (
                            <View style={styles.searchResults}>
                                {searchResults.map((student) => (
                                    <View key={student.id} style={styles.resultItem}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.resultName}>{student.name || student.email}</Text>
                                            <Text style={styles.resultCareer}>{student.career || 'Sin carrera'} • Semestre {student.currentSemester || '?'}</Text>
                                        </View>
                                        <Pressable
                                            style={styles.addButton}
                                            onPress={() => handleAddMember(student.id)}
                                            disabled={isAddingMember}
                                        >
                                            <Text style={styles.addButtonText}>Añadir</Text>
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        )}
                        {searchResults.length === 0 && searchQuery.trim() !== '' && !isSearching && (
                            <Text style={styles.noResultsText}>No se encontraron resultados nuevos.</Text>
                        )}
                    </View>
                )}

                {session && isGroupOwner(session.user, editingGroup) ? (
                    <>
                        <Pressable
                            style={[styles.deleteButton, isDeleting && { opacity: 0.6 }]}
                            onPress={handleDeleteGroup}
                            disabled={isDeleting || isLeavingGroup}
                        >
                            <Text style={styles.deleteButtonText}>
                                {isDeleting ? 'Eliminando...' : 'Eliminar Grupo'}
                            </Text>
                        </Pressable>

                        {editingGroup.members.length > 1 && (
                            <Pressable
                                style={[
                                    styles.deleteButton, 
                                    { marginTop: 10, backgroundColor: '#f59e0b', borderColor: '#f59e0b' }, 
                                    (isLeavingGroup || isWaitingTransfer) && { opacity: 0.6 }
                                ]}
                                onPress={() => setShowTransferModal(true)}
                                disabled={isDeleting || isLeavingGroup || isWaitingTransfer}
                            >
                                <Text style={[styles.deleteButtonText, { color: '#fff' }]}>
                                    {isWaitingTransfer ? 'Esperando aceptación...' : 'Transferir Admón y Abandonar'}
                                </Text>
                            </Pressable>
                        )}
                        {isWaitingTransfer && (
                            <Text style={{ textAlign: 'center', marginTop: 10, color: '#f59e0b', fontStyle: 'italic' }}>
                                Has solicitado transferir este grupo. Tu salida se procesará cuando el nuevo administrador acepte.
                            </Text>
                        )}
                    </>
                ) : (
                    <Pressable
                        style={[styles.deleteButton, { marginTop: 10, backgroundColor: '#ef4444', borderColor: '#ef4444' }, isLeavingGroup && { opacity: 0.6 }]}
                        onPress={handleLeaveGroup}
                        disabled={isLeavingGroup}
                    >
                        <Text style={[styles.deleteButtonText, { color: '#fff' }]}>
                            {isLeavingGroup ? 'Abandonando...' : 'Abandonar Grupo'}
                        </Text>
                    </Pressable>
                )}
                {renderProfileModal()}

                {/* Transfer Modal */}
                <Modal
                    visible={showTransferModal}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setShowTransferModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Delegar Administración</Text>
                            <Text style={styles.subtitle}>Selecciona al nuevo administrador antes de abandonar el grupo.</Text>

                            <ScrollView style={{ maxHeight: 300, marginVertical: 10 }}>
                                {editingGroup?.members.filter(m => m.id !== editingGroup.ownerId).map(member => (
                                    <Pressable
                                        key={member.id}
                                        style={[
                                            styles.memberItem,
                                            selectedNewOwner === member.id && { borderColor: Colors.light.tint, borderWidth: 2 }
                                        ]}
                                        onPress={() => setSelectedNewOwner(member.id)}
                                    >
                                        <Text style={styles.memberName}>{member.name || member.email}</Text>
                                        <Text style={styles.memberCareer}>{member.career || 'Sin carrera'} • Semestre {member.currentSemester || '?'}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>

                            <View style={styles.modalActions}>
                                <Pressable
                                    style={[styles.modalButton, styles.cancelModalButton]}
                                    onPress={() => setShowTransferModal(false)}
                                    disabled={isLeavingGroup}
                                >
                                    <Text style={styles.cancelModalButtonText}>Cancelar</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.modalButton, styles.saveModalButton, !selectedNewOwner && { opacity: 0.5 }]}
                                    onPress={handleTransferAndLeave}
                                    disabled={isLeavingGroup || !selectedNewOwner}
                                >
                                    <Text style={styles.saveModalButtonText}>{isLeavingGroup ? 'Procesando...' : 'Transferir y Salir'}</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        );
    }

    // List mode UI
    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
                <Stack.Screen options={{ title: 'Grupos de Estudio' }} />
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButtonOnly}>
                        <Text style={styles.backButtonText}>← Atrás</Text>
                    </Pressable>
                    <Text style={styles.title}>Grupos de Estudio</Text>
                </View>

                <View style={styles.tabContainer}>
                    <Pressable
                        onPress={() => handleTabChange('mine')}
                        style={[styles.tabButton, activeTab === 'mine' && styles.activeTab]}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'mine' && styles.activeTabText]}>Mis Grupos</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => handleTabChange('discover')}
                        style={[styles.tabButton, activeTab === 'discover' && styles.activeTab]}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'discover' && styles.activeTabText]}>Descubrir Grupos</Text>
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.listContainer}
                    keyboardShouldPersistTaps="handled"
                    onScrollBeginDrag={Keyboard.dismiss}
                >
                    {activeTab === 'mine' && (!groups || groups.length === 0) ? (
                        <Text style={styles.emptyText}>No perteneces a ningún grupo de estudio todavía. ¡Crea uno!</Text>
                    ) : activeTab === 'discover' && (!discoverGroups || discoverGroups.length === 0) ? (
                        <Text style={styles.emptyText}>No hay grupos disponibles para mostrar.</Text>
                    ) : null}

                    {((activeTab === 'mine' ? groups : discoverGroups) || []).map((group) => {
                        const isOwner = session && isGroupOwner(session.user, group);
                        const isDiscover = activeTab === 'discover';
                        const isRequesting = isRequestingMap[group.id] || false;

                        return (
                            <View key={group.id} style={styles.groupCard}>
                                <View style={styles.groupHeader}>
                                    <Text style={styles.groupName}>{group.name}</Text>
                                    {isOwner && !isDiscover && (
                                        <View style={styles.ownerBadge}>
                                            <Text style={styles.ownerBadgeText}>Administrador</Text>
                                        </View>
                                    )}
                                </View>
                                {!!group.description && <Text style={styles.groupDesc}>{group.description}</Text>}
                                <Text style={styles.groupMembersCount}>
                                    {(() => { const count = group.members?.length ?? (group as any)._count?.members ?? 0; return `${count} ${count === 1 ? 'miembro' : 'miembros'}`; })()}
                                </Text>

                                {isDiscover ? (
                                    <Pressable
                                        style={[styles.manageButton, styles.joinButton, isRequesting && { opacity: 0.7 }]}
                                        onPress={() => handleJoinRequest(group.id)}
                                        disabled={isRequesting}
                                    >
                                        <Text style={[styles.manageButtonText, styles.joinButtonText]}>
                                            {isRequesting ? 'Enviando...' : 'Solicitar unirme'}
                                        </Text>
                                    </Pressable>
                                ) : (
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                        <Pressable
                                            style={[styles.manageButton, { flex: 1 }]}
                                            onPress={() => {
                                                setEditingGroup(group);
                                                setEditInfoName(group.name);
                                                setEditInfoDesc(group.description || '');
                                            }}
                                        >
                                            <Text style={styles.manageButtonText}>{isOwner ? 'Gestionar' : 'Info'}</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[styles.manageButton, { flex: 1 }]}
                                            onPress={() => router.push({ pathname: '/study-group-wall', params: { id: group.id, title: group.name, ownerId: group.ownerId } } as any)}
                                        >
                                            <Text style={styles.manageButtonText}>Ver Muro</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[styles.manageButton, { flex: 1, backgroundColor: '#dbeafe' }]}
                                            onPress={() => router.push({ pathname: '/study-group-chat', params: { id: group.id, title: group.name } } as any)}
                                        >
                                            <Text style={[styles.manageButtonText, { color: '#1d4ed8' }]}>Chat</Text>
                                        </Pressable>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>

                <View style={styles.fabContainer}>
                    <Pressable style={styles.fab} onPress={() => setCreateModalVisible(true)}>
                        <Text style={styles.fabText}>Crear Grupo</Text>
                    </Pressable>
                </View>

                {/* Create Modal */}
                <Modal
                    visible={isCreateModalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setCreateModalVisible(false)}
                >
                    <Pressable style={styles.modalOverlay} onPress={() => Keyboard.dismiss()}>
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
                            <Pressable style={styles.modalContent} onPress={() => { }}>
                                <Text style={styles.modalTitle}>Crear nuevo grupo</Text>

                                <Text style={styles.label}>Nombre del grupo</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newGroupName}
                                    onChangeText={setNewGroupName}
                                    placeholder="Ej: Programación Avanzada"
                                    placeholderTextColor="#94a3b8"
                                />

                                <Text style={styles.label}>Descripción (Opcional)</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={newGroupDesc}
                                    onChangeText={setNewGroupDesc}
                                    placeholder="De qué trata el grupo..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                    numberOfLines={3}
                                />

                                <Text style={styles.label}>Asignatura (Opcional)</Text>
                                <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 8, marginTop: -8 }}>
                                    Máximo 3 grupos por asignatura. Selecciona para validar el límite.
                                </Text>
                                <TextInput
                                    style={[styles.input, { marginBottom: 6 }]}
                                    value={subjectSearch}
                                    onChangeText={setSubjectSearch}
                                    placeholder="Buscar asignatura..."
                                    placeholderTextColor="#94a3b8"
                                />
                                {selectedSubjectId && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: '#dbeafe', padding: 8, borderRadius: 8 }}>
                                        <Text style={{ flex: 1, color: '#1d4ed8', fontWeight: '600' }}>
                                            ✓ {subjects.find(s => s.id === selectedSubjectId)?.name}
                                        </Text>
                                        <Pressable onPress={() => setSelectedSubjectId(null)}>
                                            <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>✕</Text>
                                        </Pressable>
                                    </View>
                                )}
                                {subjectSearch.trim().length > 0 && (
                                    <ScrollView style={{ maxHeight: 150, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }}>
                                        {subjects
                                            .filter(s => s.name.toLowerCase().includes(subjectSearch.toLowerCase()))
                                            .map(s => (
                                                <Pressable
                                                    key={s.id}
                                                    style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: selectedSubjectId === s.id ? '#eff6ff' : 'white' }}
                                                    onPress={() => { setSelectedSubjectId(s.id); setSubjectSearch(''); }}
                                                >
                                                    <Text style={{ color: '#0f172a' }}>{s.name}</Text>
                                                </Pressable>
                                            ))
                                        }
                                    </ScrollView>
                                )}

                                <View style={styles.modalActions}>
                                    <Pressable
                                        style={[styles.modalButton, styles.cancelModalButton]}
                                        onPress={() => { setCreateModalVisible(false); setSelectedSubjectId(null); setSubjectSearch(''); }}
                                        disabled={isCreating}
                                    >
                                        <Text style={styles.cancelModalButtonText}>Cancelar</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.modalButton, styles.saveModalButton]}
                                        onPress={handleCreateGroup}
                                        disabled={isCreating}
                                    >
                                        <Text style={styles.saveModalButtonText}>{isCreating ? 'Creando...' : 'Crear'}</Text>
                                    </Pressable>
                                </View>
                            </Pressable>
                        </KeyboardAvoidingView>
                    </Pressable>
                </Modal>

                {renderProfileModal()}
            </View>
        </TouchableWithoutFeedback>
    );
} const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    contentContainer: {
        padding: 20,
        paddingTop: 40,
    },
    header: {
        padding: 20,
        paddingTop: 50,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    listContainer: {
        padding: 20,
        paddingBottom: 100, // space for fab
    },
    loaderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
    },
    loaderText: {
        marginTop: 10,
        fontSize: 14,
        color: '#475569',
    },
    backButton: {
        marginBottom: 16,
    },
    backButtonOnly: {
        marginBottom: 8,
    },
    backButtonText: {
        color: '#003e70',
        fontWeight: '600',
        fontSize: 15,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 15,
        color: '#64748b',
        marginTop: 4,
        marginBottom: 16,
    },
    emptyText: {
        color: '#64748b',
        fontSize: 15,
        textAlign: 'center',
        marginTop: 40,
    },
    groupCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.05)',
        elevation: 2,
    },
    groupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    groupName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
    },
    groupDesc: {
        fontSize: 14,
        color: '#475569',
        marginBottom: 12,
    },
    groupMembersCount: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
        marginBottom: 12,
    },
    ownerBadge: {
        backgroundColor: '#dbeafe',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginLeft: 8,
        alignSelf: 'flex-start',
    },
    ownerBadgeText: {
        color: '#1d4ed8',
        fontSize: 11,
        fontWeight: '700',
    },
    removeMemberButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#fee2e2',
    },
    removeMemberButtonText: {
        color: '#ef4444',
        fontSize: 12,
        fontWeight: '600',
    },
    manageButton: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    manageButtonText: {
        color: '#0f172a',
        fontWeight: '600',
        fontSize: 14,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
    },
    fab: {
        backgroundColor: '#003e70',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        boxShadow: '0px 4px 8px rgba(0, 62, 112, 0.3)',
        elevation: 4,
    },
    fabText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0f172a',
        marginBottom: 16,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelModalButton: {
        backgroundColor: '#f1f5f9',
    },
    cancelModalButtonText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 15,
    },
    saveModalButton: {
        backgroundColor: '#0f172a',
    },
    saveModalButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    closeIcon: {
        padding: 5,
    },
    profileDetails: {
        alignItems: 'center',
    },
    profileAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.light.tint,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    profileAvatarText: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: 'bold',
    },
    profileName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 5,
    },
    profileEmail: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
    },
    profileInfoBox: {
        width: '100%',
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        padding: 15,
    },
    profileInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    profileInfoText: {
        fontSize: 16,
        color: '#444',
        marginLeft: 10,
    },
    profileInfoValue: {
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tabButton: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#003e70',
    },
    tabButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748b',
    },
    activeTabText: {
        color: '#003e70',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 12,
    },
    memberItem: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    memberName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    memberCareer: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    viewProfileButton: {
        padding: 5,
    },
    searchRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    flexInput: {
        flex: 1,
        marginBottom: 0,
    },
    searchButton: {
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    searchButtonText: {
        color: '#0f172a',
        fontWeight: '600',
    },
    searchResults: {
        marginTop: 8,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    resultName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    resultCareer: {
        fontSize: 13,
        color: '#64748b',
    },
    addButton: {
        backgroundColor: '#1d4ed8',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        marginLeft: 12,
    },
    addButtonText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 13,
    },
    noResultsText: {
        color: '#64748b',
        fontStyle: 'italic',
        marginTop: 8,
    },
    deleteButton: {
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#ef4444',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 20,
    },
    deleteButtonText: {
        color: '#dc2626',
        fontWeight: '700',
        fontSize: 15,
    },
    joinButton: {
        backgroundColor: '#003e70',
    },
    joinButtonText: {
        color: '#ffffff',
    },
});
