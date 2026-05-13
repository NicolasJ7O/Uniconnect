import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { saveSession } from '@/lib/session';
import apiClient from '@/lib/api-client';

WebBrowser.maybeCompleteAuthSession();

// Restringir forzosamente a cuentas institucionales de Ucaldas como se solicitó
const ALLOWED_DOMAIN = 'ucaldas.edu.co';

export function useGoogleAuth() {
    const [user, setUser] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Utilizamos las credenciales de Auth0 inyectadas en .env
    const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN!;
    const clientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID!;

    const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'com.ucaldas.estudiantes',
        path: 'oauthredirect',
    });

    const discovery = AuthSession.useAutoDiscovery(`https://${auth0Domain}`);

    // Configurando la petición a Auth0
    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId,
            redirectUri,
            scopes: ['openid', 'profile', 'email'],
        },
        discovery
    );

    const signIn = () => {
        if (!auth0Domain || !clientId) {
            setError('Faltan credenciales de Auth0 en .env');
            return;
        }
        setError(null);
        promptAsync();
    };

    useEffect(() => {
        if (response?.type === 'success') {
            fetchUserInfo(response.authentication!.accessToken);
        }
        if (response?.type === 'error') {
            const oauthError = (response?.params as any)?.error_description || (response?.params as any)?.error || 'Solicitud OAuth inválida';
            setError(`Auth0 OAuth: ${oauthError}`);
        }
        if (response?.type === 'dismiss' || response?.type === 'cancel') {
            setError('Inicio de sesión cancelado.');
        }
    }, [response]);

    const fetchUserInfo = async (token: string) => {
        setLoading(true);
        setError(null);
        try {
            // Extraer email y nombre de la bóveda de Auth0
            const res = await fetch(`https://${auth0Domain}/userinfo`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            
            // Validar restricción obligatoria @ucaldas.edu.co
            if (!data.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
                setError(`Solo se permiten cuentas institucionales @${ALLOWED_DOMAIN}`);
                setLoading(false);
                return;
            }

            // Sincronizar el token con el backend usando /auth/simple para salvaguardar la arquitectura actual 
            // e instanciar al usuario mediante Auth0
            try {
                const backendRes = await apiClient.post('/auth/simple', { 
                    email: data.email,
                    name: data.name || data.nickname || data.email
                });
                
                const { accessToken: localToken, refreshToken, user: backendUser } = backendRes.data;
                await saveSession({
                    user: {
                        id: backendUser.id,
                        name: backendUser.name,
                        email: backendUser.email,
                        role: backendUser.role || 'student',
                        avatarUrl: backendUser.avatarUrl || data.picture || null,
                    },
                    accessToken: localToken,
                    refreshToken,
                });

                setUser(backendUser);
            } catch (backendError: any) {
                const msg = backendError?.response?.data?.message || 'Error al conectar la sesión con Uniconnect';
                setError(msg);
            }
        } catch (e) {
            setError('Error al obtener perfil institucional desde Auth0');
        } finally {
            setLoading(false);
        }
    };

    const signOut = () => setUser(null);

    return { user, error, loading, request, signIn, signOut };
}