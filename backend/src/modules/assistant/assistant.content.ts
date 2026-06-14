export type AssistantRole = 'student' | 'moderator' | 'super_admin';

export type AssistantKnowledgeChunk = {
  id: string;
  title: string;
  section: string;
  audience: AssistantRole[];
  keywords: string[];
  reference: string;
  summary: string;
  content: string;
};

export const assistantKnowledgeBase: AssistantKnowledgeChunk[] = [
  {
    id: 'student-profile',
    title: 'Perfil estudiantil y módulos visibles',
    section: 'backend/src/modules/student/README.md',
    audience: ['student', 'moderator', 'super_admin'],
    keywords: ['perfil', 'estudiante', 'estadisticas', 'insignias', 'asignaturas', 'dashboard'],
    reference: 'backend/src/modules/student/README.md · Decorator para perfiles',
    summary: 'Explica cómo UniConnect arma el perfil base y lo enriquece con estadísticas e insignias sin tocar autenticación.',
    content: 'El módulo de estudiantes usa Decorator para componer el perfil base con estadísticas e insignias. Es la base para el dashboard y para la vista completa del estudiante.',
  },
  {
    id: 'study-groups',
    title: 'Grupos de estudio y flujo de administración',
    section: 'backend/src/modules/study-group/README.md',
    audience: ['student', 'moderator', 'super_admin'],
    keywords: ['grupo', 'grupos', 'administracion', 'miembro', 'solicitud', 'transferencia'],
    reference: 'backend/src/modules/study-group/README.md · Observer de grupos de estudio',
    summary: 'Describe el ciclo de solicitudes, aceptación, rechazo y transferencia de administración en grupos.',
    content: 'El módulo de grupos de estudio persiste eventos y los notifica por WebSocket. También controla solicitudes de ingreso y transferencia de administración.',
  },
  {
    id: 'chat-architecture',
    title: 'Chat, decoradores y observadores',
    section: 'backend/src/modules/chat/README.md',
    audience: ['student', 'moderator', 'super_admin'],
    keywords: ['chat', 'mensaje', 'decorator', 'observer', 'websocket', 'poll', 'encuesta'],
    reference: 'backend/src/modules/chat/README.md · Decorator & Observer',
    summary: 'Explica cómo el chat compone mensajes con decoradores y propaga eventos en tiempo real mediante observers.',
    content: 'El módulo de chat usa Decorator para enriquecer mensajes y Observer para propagar nuevos mensajes por WebSocket en grupos y chats privados.',
  },
  {
    id: 'backend-production',
    title: 'Despliegue y variables del backend',
    section: 'backend/README.md',
    audience: ['moderator', 'super_admin'],
    keywords: ['despliegue', 'fly', 'variables', 'secrets', 'database', 'prisma'],
    reference: 'backend/README.md · Entorno de Producción en Fly.io',
    summary: 'Resume cómo se despliega el backend y qué variables sensibles exige la infraestructura.',
    content: 'El backend en producción se despliega en Fly.io y depende de variables como DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET y REFRESH_TOKEN_PEPPER.',
  },
  {
    id: 'auth-hardening',
    title: 'Autenticación institucional',
    section: 'backend/README.md',
    audience: ['moderator', 'super_admin'],
    keywords: ['auth', 'google', 'refresh', 'session', 'jwt', 'dominio'],
    reference: 'backend/README.md · Criterios de seguridad incluidos',
    summary: 'Describe la validación del token, la restricción por dominio y la rotación de refresh tokens.',
    content: 'La autenticación valida tokens Google, restringe dominios institucionales y rota refresh tokens por sesión. El chatbot no modifica este flujo; solo lo reutiliza para leer rol y usuario.',
  },
  {
    id: 'moderation-permissions',
    title: 'Permisos administrativos',
    section: 'backend/src/modules/library/handlers/role-permission.handler.ts',
    audience: ['moderator', 'super_admin'],
    keywords: ['moderador', 'moderation', 'permisos', 'admin', 'delete', 'edit'],
    reference: 'backend/src/modules/library/handlers/role-permission.handler.ts · Role permission handler',
    summary: 'Muestra la separación de permisos entre estudiantes y moderadores para acciones de edición y moderación.',
    content: 'Los moderadores pueden saltarse parte de la verificación de propiedad en acciones de edición y eliminación; la moderación estricta se limita al rol adecuado.',
  },
  {
    id: 'web-dashboard',
    title: 'Dashboard y navegación web',
    section: 'front/README.md',
    audience: ['student', 'moderator', 'super_admin'],
    keywords: ['dashboard', 'web', 'router', 'expo', 'navegacion', 'widget'],
    reference: 'front/README.md · file-based routing y workflows',
    summary: 'Explica la estructura del dashboard web y el uso de file-based routing en Expo Router.',
    content: 'El frontend usa Expo Router con rutas basadas en archivos. El dashboard puede alojar widgets embebidos sin romper el diseño existente.',
  },
];
