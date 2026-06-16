# Módulo de Chat - Patrones Decorator & Observer

Este módulo implementa dos patrones de diseño fundamentales para lograr una arquitectura de mensajería altamente flexible, desacoplada y escalable: el patrón estructural **Decorator** para enriquecer los mensajes y el patrón de comportamiento **Observer** para la mensajería en tiempo real.

---

## 1. Patrón Structural Decorator (Composición de Mensajes)

El patrón **Decorator** permite componer y ampliar las capacidades de los mensajes de chat de manera dinámica y flexible sin modificar su implementación interna.

### Componentes Clave:
1. **`IMensaje`**: Interfaz común que define el contrato de comportamiento para todos los componentes de mensaje (`getContenido()`, `getMetadata()`, `render()`).
2. **`MensajeBase`**: El componente concreto base. Representa un mensaje de texto plano con información del remitente (`userId`) y marca de tiempo (`timestamp`).
3. **`MessageDecorator`**: Clase decoradora abstracta que mantiene una referencia al objeto `IMensaje` decorado y delega las llamadas de forma transparente.
4. **`MensajeConArchivo`**: Decorador concreto que añade soporte para adjuntos (URL, tipo MIME y tamaño en bytes) y amplía la salida de `render()` y `getMetadata()`.
5. **`MensajeConMencion`**: Decorador concreto que permite registrar usuarios mencionados y resalta visualmente en la salida renderizada (`<span class="mention">@userId</span>`).
6. **`MensajeConReaccion`**: Decorador concreto que gestiona las reacciones de los usuarios agregando y renderizando badges interactivos.

### Diagrama UML de Clases (Decorator)
```mermaid
classDiagram
    class IMensaje {
        <<interface>>
        +getContenido() string
        +getMetadata() Record~string, any~
        +render() string
    }

    class MensajeBase {
        -contenido: string
        -userId: string
        -timestamp: Date
        +getContenido() string
        +getMetadata() Record~string, any~
        +render() string
    }

    class MessageDecorator {
        <<abstract>>
        #mensaje: IMensaje
        +getContenido() string
        +getMetadata() Record~string, any~
        +render() string
    }

    class MensajeConArchivo {
        -url: string
        -mimeType: string
        -tamano: number
        +getMetadata() Record~string, any~
        +render() string
    }

    class MensajeConMencion {
        -userIdsMencionados: string[]
        +getMetadata() Record~string, any~
        +render() string
    }

    class MensajeConReaccion {
        -reacciones: Map~string, Reaccion~
        +agregarReaccion(emoji: string, userId: string) void
        +getMetadata() Record~string, any~
        +render() string
    }

    IMensaje <|.. MensajeBase : Realizes
    IMensaje <|.. MessageDecorator : Realizes
    MessageDecorator o--> IMensaje : Decorates
    MessageDecorator <|-- MensajeConArchivo : Inherits
    MessageDecorator <|-- MensajeConMencion : Inherits
    MessageDecorator <|-- MensajeConReaccion : Inherits
```

---

## 2. Patrón Behavioral Observer (Mensajería en Tiempo Real)

El patrón **Observer** se utiliza para desacoplar el flujo de persistencia de mensajes del envío en vivo por WebSockets, permitiendo notificar de forma independiente a canales grupales y privados.

### Catálogo de Eventos (`ChatEvent`):
* **`NUEVO_MENSAJE`**: Emitido cuando se crea un nuevo mensaje en el sistema (grupal o privado), llevando consigo el mensaje ya completamente decorado.

### Componentes Clave:
1. **`IChatSubject`**: Interfaz común que define los métodos `attach()`, `detach()` y `notify()`.
2. **`ChatSubject`**: Implementación Singleton central del subject que emite los eventos tipados de mensajería.
3. **`GroupChatObserver`**: Observer concreto responsable de propagar mensajes grupales en vivo utilizando el canal de sala del grupo correspondiente (`group-${groupId}`).
4. **`PrivateChatObserver`**: Observer concreto e independiente responsable de notificar los mensajes privados de forma aislada a los sockets de los dos usuarios participantes (`user-${userId}`), evitando la mezcla de eventos o filtraciones.

### Diagrama UML de Clases (Observer)
```mermaid
classDiagram
    class IChatSubject {
        <<interface>>
        +attach(observer: IChatObserver) void
        +detach(observer: IChatObserver) void
        +notify(event: ChatEvent, data: any) Promise~void~
    }

    class IChatObserver {
        <<interface>>
        +update(event: ChatEvent, data: any) Promise~void~
    }

    class ChatSubject {
        -observers: IChatObserver[]
        -static instance: ChatSubject
        +static getInstance() ChatSubject
        +attach(observer: IChatObserver) void
        +detach(observer: IChatObserver) void
        +notify(event: ChatEvent, data: any) Promise~void~
    }

    class GroupChatObserver {
        +update(event: ChatEvent, data: any) Promise~void~
    }

    class PrivateChatObserver {
        +update(event: ChatEvent, data: any) Promise~void~
    }

    IChatSubject <|.. ChatSubject : Realizes
    IChatObserver <|.. GroupChatObserver : Realizes
    IChatObserver <|.. PrivateChatObserver : Realizes
    ChatSubject o--> IChatObserver : Notifies
```

---

## 3. Ejemplo de Uso de los Patrones Combinados

### Composición de Decoradores:
```typescript
let mensaje = new MensajeBase("Hola @user123, adjunto la tarea :)", "user123", new Date());
mensaje = new MensajeConArchivo(mensaje, "/uploads/tarea.pdf", "application/pdf", 10245);
mensaje = new MensajeConMencion(mensaje, ["user123"]);
```

### Notificación mediante el Observer:
```typescript
// Notificar a todos los observers registrados automáticamente en tiempo real
const chatSubject = ChatSubject.getInstance();
chatSubject.notify('NUEVO_MENSAJE', {
  isPrivate: false,
  message: mensajeDecoradoDTO
});
```

---

## 4. Patrón Chain of Responsibility (Moderación de Mensajes)

Implementado en el **Sprint 4**, este patrón procesa obligatoriamente todo mensaje enviado (privado o grupal) a través de una canalización ordenada de handlers antes de autorizar su almacenamiento y emisión por Socket.io.

### Pipeline de Moderación:
La ejecución de la cadena sigue el orden secuencial estricto:
`LongitudHandler` ➔ `PalabrasProhibidasHandler` ➔ `SpamHandler` ➔ `EnlacesExternosHandler` ➔ `PersistenciaHandler`

1. **`LongitudHandler` (Código `MO_001`)**: Rechaza mensajes que excedan los 1000 caracteres, deteniendo el pipeline de forma inmediata.
2. **`PalabrasProhibidasHandler` (Código `MO_002`)**: Escanea el mensaje contra una lista configurable de palabras inapropiadas. Si detecta alguna, rechaza el mensaje guardando el término específico en la auditoría sin revelarlo al usuario.
3. **`SpamHandler` (Código `MO_003`)**: Controla que un usuario no envíe más de 5 mensajes en menos de 30 segundos. Si infringe la regla, persiste un bloqueo por 5 minutos en `UserBlock` y rechaza cualquier mensaje subsiguiente mientras el bloqueo permanezca activo.
4. **`EnlacesExternosHandler` (Código `MO_004`)**: Verifica todos los hipervínculos del mensaje. Solo se permiten dominios especificados en la whitelist institucional (ej. `ucaldas.edu.co`, `github.com`).
5. **`PersistenciaHandler`**: El handler final de ejecución exitosa. Persiste el mensaje en la base de datos, aplica decoradores del Sprint 3 y notifica a los observers para la emisión por WebSocket.

### Diagrama UML de Clases (Chain of Responsibility)
```mermaid
classDiagram
    class ModerationContext {
        +userId: string
        +content: string
        +chatId: string
        +isPrivate: boolean
        +fileUrl: string
        +fileName: string
        +fileType: string
        +poll: object
        +ip: string
        +metadata: any
    }

    class ModerationResult {
        +approved: boolean
        +moderationCode: string
        +message: string
        +handler: string
        +savedMessage: any
    }

    class ModerationHandler {
        <<abstract>>
        -nextHandler: ModerationHandler
        +setNext(handler: ModerationHandler) ModerationHandler
        +handle(ctx: ModerationContext) ModerationResult
        #process(ctx: ModerationContext) ModerationResult*
    }

    class LongitudHandler {
        #process(ctx: ModerationContext) ModerationResult
    }

    class PalabrasProhibidasHandler {
        #process(ctx: ModerationContext) ModerationResult
    }

    class SpamHandler {
        #process(ctx: ModerationContext) ModerationResult
    }

    class EnlacesExternosHandler {
        #process(ctx: ModerationContext) ModerationResult
    }

    class PersistenciaHandler {
        #process(ctx: ModerationContext) ModerationResult
    }

    ModerationHandler <|-- LongitudHandler : Inherits
    ModerationHandler <|-- PalabrasProhibidasHandler : Inherits
    ModerationHandler <|-- SpamHandler : Inherits
    ModerationHandler <|-- EnlacesExternosHandler : Inherits
    ModerationHandler <|-- PersistenciaHandler : Inherits
    ModerationHandler o--> ModerationHandler : Links next
```

### Registro de Auditoría y Control de Persistencia
Si cualquier handler de la cadena rechaza un mensaje:
- **No se almacena** en la tabla de `Message`.
- **No se emite** a otros usuarios vía Socket.io.
- Se registra de forma automática la incidencia en la tabla `ModerationAuditLog` incluyendo:
  - Remitente (`userId`)
  - Identificador de Chat (`chatId`)
  - Fragmento anonimizado del mensaje (ej: `hol...nte`)
  - Código de error de moderación (`moderationCode`)
  - Handler que procesó el rechazo
  - Metadatos del cliente (ej: Dirección IP, User Agent)

