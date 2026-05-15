import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { saveSession } from '@/lib/session';
import { signInWithAuth0 } from '@/lib/auth-api';

WebBrowser.maybeCompleteAuthSession();

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
            const { code, access_token } = response.params;
            
            if (response.authentication?.accessToken) {
                syncWithBackend(response.authentication.accessToken);
            } else if (access_token) {
                syncWithBackend(access_token);
            } else if (code && discovery) {
                // Intercambiar el código de autorización por el token usando PKCE
                AuthSession.exchangeCodeAsync(
                    {
                        clientId,
                        code,
                        redirectUri,
                        extraParams: request?.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
                    },
                    discovery
                )
                .then((auth) => {
                    syncWithBackend(auth.accessToken);
                })
                .catch((err) => {
                    console.error("Error exchanging code", err);
                    setError('Error al intercambiar el código de acceso.');
                });
            } else {
                setError('No se recibió un token de acceso válido.');
            }
        }
        if (response?.type === 'error') {
            const oauthError = (response?.params as any)?.error_description || (response?.params as any)?.error || 'Solicitud OAuth inválida';
            setError(`Auth0 OAuth: ${oauthError}`);
        }
        if (response?.type === 'dismiss' || response?.type === 'cancel') {
            setError('Inicio de sesión cancelado.');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [response]);

    const syncWithBackend = async (accessToken: string) => {
        setLoading(true);
        setError(null);
        try {
            // Validate the token exclusively and securely through the Backend 
            // avoiding mock/testing /auth/simple endpoint.
            const sessionData = await signInWithAuth0(accessToken);

            await saveSession({
                user: sessionData.user,
                accessToken: sessionData.accessToken,
                refreshToken: sessionData.refreshToken,
            });

            setUser(sessionData.user);
        } catch (backendError: any) {
            const msg = backendError?.response?.data?.message || 'Error de Autenticación Uniconnect';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const signOut = () => setUser(null);

    return { user, error, loading, request, signIn, signOut };
}