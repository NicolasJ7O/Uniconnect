import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { useToast } from '@/components/Toast';
import { router } from 'expo-router';
import { getStudentProfile, updateStudentProfile, getEnrichedStudentProfile, type StudentProfile } from '@/lib/student-api';

const CARRERAS = [
    "Administración de empresas agropecuarias",
    "Biología",
    "Diseño visual",
    "Enfermería",
    "Historia",
    "Ingeniería agronomica",
    "Ingeniería de alimentos",
    "Ingeniería de sistemas y computación",
    "Ingeniería en informatica",
    "Licenciatura en artes escénicas",
    "Licenciatura en ciencias naturales",
    "Licenciatura en ciencias sociales",
    "Licenciatura en educación física",
    "Licenciatura en filosofía",
    "Licenciatura en lenguas modernas",
    "Licenciatura en música",
    "Maestro en artes plasticas",
    "Maestro en música",
    "Medicina",
    "Medicina veterinaria y zootecnia",
    "Administración financiera",
    "Antropología",
    "Desarrollo familiar",
    "Derecho",
    "Sociología",
    "Trabajo social",
    "Profesional en filosofía",
    "Geología"
];

const MATERIAS_SISTEMAS = [
    "Constitución Política De Colombia",
    "Lógica Matemática",
    "Opcionales",
    "Matemáticas Discretas Ii",
    "Matemáticas Fundamentales",
    "Cálculo I",
    "Cálculo Ii",
    "Cálculo Iii",
    "Matemáticas Especiales",
    "Álgebra Lineal",
    "Matemáticas Discretas",
    "Probabilidad",
    "Física Ii-Ing",
    "Física I Ing",
    "Física Iii Ing",
    "Laboratorio De Física I Ing",
    "Laboratorio De Física Ii Ing",
    "Laboratorio Fisica I Ing",
    "Laboratorio Fisica Ii Ing",
    "Biologia Para Ingenieria",
    "Programacion I",
    "Programación Ii",
    "Programacion Iii",
    "Programación Concurrente Y Distribuida",
    "Teoría General De Sistemas",
    "Autómatas Y Lenguajes Formales",
    "Estructura De Lenguajes",
    "Sistemas Inteligentes I",
    "Sistemas Inteligentes Ii",
    "Análisis Y Diseño De Algoritmos",
    "Investigación Para Ingeniería",
    "Introducción A La Ingeniería De Sistemas Y Computación",
    "Inglés Para Ingeniería",
    "Automatización Y Control De Procesos",
    "Sistemas Operativos",
    "Comunicaciones De Datos",
    "Redes De Computadores I",
    "Redes De Computadores Iii",
    "Redes De Computadores Ii",
    "Ingeniería De Software I",
    "Ingeniería De Software Ii",
    "Ingeniería De Software Iii",
    "Arquitectura De Computadores",
    "Circuitos Digitales",
    "Microprocesadores",
    "Diseño De Interfaces",
    "Practica",
    "Seguridad Informática",
    "Auditoría Informática",
    "Proyecto Integrador",
    "Gestión Tecnológica",
    "Gestion De Proyectos",
    "Bases De Datos I",
    "Estructuras De Datos",
    "Administración De Sistemas",
    "Bases De Datos Ii",
    "Ingeniería Del Conocimiento",
    "Habilidades Gerenciales",
    "Ingeniería Económica Y Financiera",
    "Investigación De Mercados",
    "Investigación De Operaciones",
    "Implantación Y Aplicación De La Gestión Del Conocimiento",
    "Framework Laravel Para Desarrollo Web",
    "Framework Spring Para Desarrollo Web",
    "Taller De Pruebas De Software",
    "Desarrollo Avanzado Aplicaciones Web Con Asp.Net Mvc 5",
    "Social Network Analysis",
    "Habilidades Blandas Para Ingeniería De Sistemas Y Computación",
    "Database Sql Expert",
    "Taller De Sistemas Operativos",
    "Modelado Computacional De Sistemas Físicos Y Biológicos",
    "Programacion Para Dispositivos Moviles",
    "Rotaciones En Sistemas Y Computacion",
    "Procesamiento Digital De Imágenes",
    "Inteligencia De Negocios",
    "Vision Artificial En Tiempo Real",
    "Web Semántica",
    "Laboratorio De Soa",
    "Industralización De Software",
    "Emprendimiento Y Creacion De Empresas De Base Tecnologica",
    "Calidad En El Desarrollo De Software",
    "Arquitectura Empresarial",
    "Fundamentos De Ingeniería Biomédica",
    "Desarrollo De Videojuegos",
    "Introducción A La Robótica"
];

// Elimina tildes para comparaciones insensibles a acentos
const normalize = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function ProfileEditScreen() {
    const { showToast } = useToast();
    const [profile, setProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [career, setCareer] = useState('');
    const [currentSemester, setCurrentSemester] = useState('');
    const [subjects, setSubjects] = useState<string[]>([]);
    const [newSubject, setNewSubject] = useState('');
    const [showCarreras, setShowCarreras] = useState(false);
    const [showSubjects, setShowSubjects] = useState(false);
    const [semesterError, setSemesterError] = useState('');

    // Refs para medir la posición de cada input y colocar el dropdown flotante
    const rootViewRef = useRef<View>(null);
    const careerInputRef = useRef<View>(null);
    const subjectInputRef = useRef<View>(null);
    const [careerDropPos, setCareerDropPos] = useState({ top: 0, left: 0 });
    const [subjectDropPos, setSubjectDropPos] = useState({ top: 0, left: 0 });

    const measureCareerInput = () => {
        // Mide el rootView primero para obtener el offset del header
        rootViewRef.current?.measureInWindow((rootX, rootY) => {
            careerInputRef.current?.measureInWindow((x, y, width, height) => {
                setCareerDropPos({
                    top: y + height - rootY - 16, // -16 por el marginBottom del input
                    left: x - rootX,
                });
            });
        });
    };

    const measureSubjectInput = () => {
        rootViewRef.current?.measureInWindow((rootX, rootY) => {
            subjectInputRef.current?.measureInWindow((x, y, width, height) => {
                setSubjectDropPos({
                    top: y + height - rootY - 16,
                    left: x - rootX,
                });
            });
        });
    };

    const filteredCarreras = useMemo(() => {
        if (!career) return CARRERAS;
        const q = normalize(career);
        return CARRERAS.filter(c => normalize(c).includes(q));
    }, [career]);

    const isSistemas = normalize(career) === normalize('Ingeniería de sistemas y computación');

    const filteredSubjects = useMemo(() => {
        if (!isSistemas) return [];
        const q = normalize(newSubject);
        return MATERIAS_SISTEMAS.filter(s => normalize(s).includes(q) && !subjects.includes(s));
    }, [newSubject, subjects, isSistemas]);

    useEffect(() => {
        async function fetchProfile() {
            try {
                const data = await getStudentProfile();
                setProfile(data);
                setCareer(data.career || '');
                setCurrentSemester(data.currentSemester ? data.currentSemester.toString() : '');
                setSubjects(data.subjects.map((sub) => sub.name));

                try {
                    const enriched = await getEnrichedStudentProfile(data.id);
                    setProfile((prev: any) => ({ ...prev, insignias: enriched.insignias, stats: enriched.stats }));
                } catch(e) { console.log('No se pudo cargar detalles enriquecidos', e) }

            } catch (error) {
                console.error('Failed to load profile', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchProfile();
    }, []);

    const handleAddSubject = () => {
        const trimmed = newSubject.trim();
        if (!trimmed) return;

        if (isSistemas) {
            const match = MATERIAS_SISTEMAS.find(m => m.toLowerCase() === trimmed.toLowerCase());
            if (match && !subjects.includes(match)) {
                setSubjects([...subjects, match]);
                setNewSubject('');
                setShowSubjects(false);
            } else {
                Alert.alert('Materia no válida', 'Por favor selecciona una materia de la lista sugerida para tu carrera.');
            }
        } else {
            if (!subjects.includes(trimmed)) {
                setSubjects([...subjects, trimmed]);
                setNewSubject('');
            }
        }
    };

    const handleRemoveSubject = (index: number) => {
        const updated = [...subjects];
        updated.splice(index, 1);
        setSubjects(updated);
    };

    const handleSave = async () => {
        if (career.trim() && !CARRERAS.includes(career.trim())) {
            Alert.alert('Error', 'Por favor selecciona una carrera sugerida de la lista.');
            return;
        }

        const semesterNum = parseInt(currentSemester.trim(), 10);
        if (!currentSemester.trim() || isNaN(semesterNum) || semesterNum < 1 || semesterNum > 10) {
            setSemesterError('El semestre debe ser un número entre 1 y 10.');
            return;
        }

        try {
            setIsSaving(true);
            await updateStudentProfile({
                career: career.trim() || undefined,
                currentSemester: parseInt(currentSemester, 10) || undefined,
                subjects,
            });
            showToast('Perfil actualizado correctamente', 'success');
            router.back();
        } catch (error) {
            console.error('Failed to update profile', error);
            showToast('Error al guardar el perfil', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator />
                <Text style={styles.loaderText}>Cargando perfil...</Text>
            </View>
        );
    }

    const anyDropdownOpen = showCarreras || showSubjects;

    const closeDropdowns = () => {
        setShowCarreras(false);
        setShowSubjects(false);
        Keyboard.dismiss();
    };

    return (
        <View ref={rootViewRef} style={{ flex: 1 }}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => {
                    setShowCarreras(false);
                    setShowSubjects(false);
                }}
            >
                <Text style={styles.title}>Editar Perfil</Text>

                {/* Insignias y Stats */}
                {profile?.insignias && profile.insignias.length > 0 && (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={styles.label}>Tus Insignias</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {profile.insignias.map((badge: string, idx: number) => {
                        const emoji = badge === 'Fundador' ? '🏗️' : badge === 'Colaborador Estrella' ? '⭐' : badge === 'Gran Comunicador' ? '🗣️' : '🎓';
                        return (
                          <View key={idx} style={{ backgroundColor: '#f1f5f9', padding: 10, borderRadius: 12, width: 110, alignItems: 'center' }}>
                            <View style={{ backgroundColor: '#fff', padding: 6, borderRadius: 10, marginBottom: 6 }}><Text>{emoji}</Text></View>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a', textAlign: 'center' }}>{badge}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {profile?.stats && (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={styles.label}>Estadísticas</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a' }}>{profile.stats.gruposCreados ?? 0}</Text>
                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4, textAlign: 'center' }}>Grupos creados</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a' }}>{profile.stats.gruposParticipa ?? 0}</Text>
                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4, textAlign: 'center' }}>Grupos miembro</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a' }}>{profile.stats.mensajesEnviados ?? 0}</Text>
                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4, textAlign: 'center' }}>Mensajes chat</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Campo Carrera — el ref se pone en el wrapper para medir su posición */}
                <View ref={careerInputRef} collapsable={false}>
                    <Text style={styles.label}>Carrera</Text>
                    <TextInput
                        style={styles.input}
                        value={career}
                        onChangeText={(text) => {
                            setCareer(text);
                            setShowCarreras(true);
                        }}
                        onFocus={() => {
                            measureCareerInput();
                            setShowCarreras(true);
                        }}
                        placeholder="Ej: Ingeniería de Sistemas"
                        placeholderTextColor="#94a3b8"
                    />
                </View>

                <Text style={styles.label}>Semestre actual</Text>
                <TextInput
                    style={[styles.input, semesterError ? styles.inputError : null]}
                    value={currentSemester}
                    onChangeText={(val) => {
                        setCurrentSemester(val);
                        const n = parseInt(val.trim(), 10);
                        if (!val.trim() || isNaN(n) || n < 1 || n > 10) {
                            setSemesterError('El semestre debe ser entre un número entre 1 y 10');
                        } else {
                            setSemesterError('');
                        }
                    }}
                    placeholder="Ej: 5"
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                />
                {semesterError ? (
                    <Text style={styles.fieldError}>{semesterError}</Text>
                ) : null}

                <Text style={styles.label}>Materias inscritas</Text>

                {!career ? (
                    <Text style={styles.infoText}>Selecciona tu carrera primero</Text>
                ) : (!isSistemas ? (
                    <Text style={styles.infoText}>El catálogo de materias para tu carrera aún no está disponible, ingresalas manualmente por favor.</Text>
                ) : null)}

                {/* Campo Materia */}
                {career ? (
                    <View ref={subjectInputRef} collapsable={false} style={styles.subjectInputRow}>
                        <TextInput
                            style={[styles.input, styles.flexInput]}
                            value={newSubject}
                            onChangeText={(text) => {
                                setNewSubject(text);
                                setShowSubjects(true);
                            }}
                            onFocus={() => {
                                measureSubjectInput();
                                setShowSubjects(true);
                            }}
                            placeholder="Buscar materia..."
                            placeholderTextColor="#94a3b8"
                        />
                        {/* Solo mostrar "Añadir" cuando la carrera NO tiene catálogo (ingreso manual) */}
                        {!isSistemas && (
                            <Pressable style={styles.addButton} onPress={handleAddSubject}>
                                <Text style={styles.addButtonLabel}>Añadir</Text>
                            </Pressable>
                        )}
                    </View>
                ) : null}

                {subjects.length === 0 ? (
                    <Text style={styles.emptyText}>No tienes materias añadidas</Text>
                ) : (
                    <View style={styles.subjectsContainer}>
                        {subjects.map((subject, index) => (
                            <View key={subject} style={styles.subjectTag}>
                                <Text style={styles.subjectText}>{subject}</Text>
                                <Pressable onPress={() => handleRemoveSubject(index)} style={styles.removeTag}>
                                    <Text style={styles.removeText}>X</Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                )}

                <Pressable style={styles.saveButton} disabled={isSaving} onPress={handleSave}>
                    <Text style={styles.saveButtonLabel}>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</Text>
                </Pressable>

                <Pressable style={styles.cancelButton} disabled={isSaving} onPress={() => router.back()}>
                    <Text style={styles.cancelButtonLabel}>Cancelar</Text>
                </Pressable>
            </ScrollView>

            {/* Overlay transparente: captura toques fuera del dropdown para cerrarlo */}
            {anyDropdownOpen && (
                <Pressable
                    style={styles.dropdownOverlay}
                    onPress={closeDropdowns}
                />
            )}

            {/* ===== DROPDOWNS FLOTANTES — renderizados FUERA del ScrollView ===== */}
            {/* Esto permite position:absolute + toque correcto en Android/iOS    */}

            {showCarreras && filteredCarreras.length > 0 && (
                <View style={[
                    styles.suggestionsContainer,
                    { top: careerDropPos.top, left: careerDropPos.left }
                ]}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                    >
                        {filteredCarreras.map((item, index) => (
                            <Pressable
                                key={index}
                                style={styles.suggestionItem}
                                onPress={() => {
                                    setCareer(item !== career ? item : item);
                                    if (item !== career) setSubjects([]);
                                    setShowCarreras(false);
                                    Keyboard.dismiss();
                                }}>
                                <Text style={styles.suggestionText}>{item}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            )}

            {showSubjects && isSistemas && filteredSubjects.length > 0 && (
                <View style={[
                    styles.suggestionsContainer,
                    { top: subjectDropPos.top, left: subjectDropPos.left }
                ]}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                    >
                        {filteredSubjects.map((item, index) => (
                            <Pressable
                                key={index}
                                style={styles.suggestionItem}
                                onPress={() => {
                                    if (!subjects.includes(item)) {
                                        setSubjects([...subjects, item]);
                                    }
                                    setNewSubject('');
                                    setShowSubjects(false);
                                    Keyboard.dismiss();
                                }}>
                                <Text style={styles.suggestionText}>{item}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}



const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },

    contentContainer: {
        padding: 20,
        paddingTop: 40,
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
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
    },
    infoText: {
        color: '#64748b',
        fontSize: 13,
        marginBottom: 12,
        fontStyle: 'italic',
    },
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0f172a',
        marginBottom: 16,
    },
    flexInput: {
        flex: 1,
        marginBottom: 0,
    },
    inputError: {
        borderColor: '#ef4444',
        borderWidth: 1.5,
        marginBottom: 4,
    },
    fieldError: {
        color: '#ef4444',
        fontSize: 12,
        marginBottom: 12,
        marginTop: -2,
    },
    dropdownOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99,
    },
    suggestionsContainer: {
        maxHeight: 200,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        position: 'absolute',
        right: 20,
        zIndex: 100,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        overflow: 'hidden',
    },
    suggestionItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    suggestionText: {
        fontSize: 15,
        color: '#334155',
    },
    subjectInputRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    addButton: {
        backgroundColor: '#045389',
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    addButtonLabel: {
        color: '#ffffff',
        fontWeight: '600',
    },
    emptyText: {
        color: '#94a3b8',
        fontStyle: 'italic',
        marginBottom: 16,
    },
    subjectsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 24,
    },
    subjectTag: {
        backgroundColor: '#e0e7ff',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 16,
    },
    subjectText: {
        color: '#3730a3',
        fontWeight: '500',
        fontSize: 13,
    },
    removeTag: {
        marginLeft: 6,
        backgroundColor: '#c7d2fe',
        borderRadius: 10,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeText: {
        fontSize: 10,
        color: '#312e81',
        fontWeight: 'bold',
    },
    saveButton: {
        backgroundColor: '#003e70',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    saveButtonLabel: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    cancelButton: {
        backgroundColor: '#bcbcbcff',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cancelButtonLabel: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});
