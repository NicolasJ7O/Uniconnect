# UniConnect Backend (Google Institutional Auth)

## 🚀 Entorno de Producción en Fly.io

El backend está configurado para desplegarse global y automáticamente en la plataforma en la nube **Fly.io**.

**URL Pública Oficial:** `https://uniconnect-backend.fly.dev`
> **Health Check:** Puedes comprobar el estado en vivo visitando [https://uniconnect-backend.fly.dev/health](https://uniconnect-backend.fly.dev/health)

### Pasos básicos de despliegue

1. **Instalar el CLI de flyctl**: [https://fly.io/docs/hands-on/install-flyctl/](https://fly.io/docs/hands-on/install-flyctl/)
2. **Autenticarse**:
   ```bash
   fly auth login
   ```
3. **Inyectar las variables de entorno sensibles (Secrets)**
   *Nunca coloquemos secretos en `fly.toml` ni en el código*.
   ```bash
   # Configurar la conexión de Base de datos
   fly secrets set DATABASE_URL="postgresql://usuario:pass@host:5432/db" DIRECT_URL="postgresql://usuario:pass@host:5432/db"

   # Configurar claves de criptografía y Google Auth
   fly secrets set GOOGLE_CLIENT_ID="tu-cliente.apps.googleusercontent.com"
   fly secrets set JWT_ACCESS_SECRET="supersecreto"
   fly secrets set REFRESH_TOKEN_PEPPER="superpepper"
   ```
4. **Desplegar la aplicación**
   ```bash
   fly deploy
   ```

---

Backend en Node + TypeScript + Express + Prisma con autenticacion Google para correo institucional.

## Requisitos
- Node 18+
- PostgreSQL online (Neon, Supabase, Render, Railway)

## 1) Instalar dependencias
```bash
npm install
```

## 2) Variables de entorno
1. Copia `.env.example` a `.env`
2. Completa valores reales:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_ALLOWED_DOMAINS`
   - `JWT_ACCESS_SECRET`
   - `REFRESH_TOKEN_PEPPER`

## 3) Prisma
```bash
npm run prisma:generate
npm run prisma:migrate -- --name init_auth
```

## 4) Ejecutar en desarrollo
```bash
npm run dev
```

API: `http://localhost:4000`

## Endpoints auth
- `POST /auth/google`
  - Body: `{ "idToken": "google_id_token" }`
  - Verifica token Google, valida dominio institucional, crea/actualiza usuario y retorna tokens de app.

- `POST /auth/refresh`
  - Body: `{ "refreshToken": "sessionId.tokenPart" }`
  - Rota refresh token y entrega nuevo access token.

- `POST /auth/logout`
  - Body: `{ "refreshToken": "sessionId.tokenPart" }`
  - Revoca sesion.

## Criterios de seguridad incluidos
- Verificacion criptografica del ID token con `google-auth-library`.
- Validacion de `iss`, `aud`, `email_verified`.
- Restriccion por dominios permitidos (`GOOGLE_ALLOWED_DOMAINS`).
- Refresh token opaco por sesion, almacenado hasheado en DB.
- Rotacion de refresh token en cada uso.

## Nota de arquitectura
Este modulo cubre solo autenticacion. Tu diagrama de negocio (posts, chats, etc.) se puede conectar despues mediante `userId` y `role`.
