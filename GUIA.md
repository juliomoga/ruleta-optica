# Guía de instalación (paso a paso)

Unos 15 minutos. No hace falta saber programar: solo crear dos cuentas gratuitas y pulsar un botón.

Al acabar tendrás tu ruleta en una dirección como `https://ruleta-tuoptica.vercel.app`, con tres
páginas: la **pantalla**, la **tablet** y el **panel**.

## Qué necesitas

- Un ordenador para la instalación.
- Una cuenta de **GitHub** (donde se guarda tu copia de la ruleta) y una de **Vercel** (la publica en
  internet y le crea la base de datos). Las dos son gratis.
- Para el evento: una **tablet** (iPad o Android) y una **pantalla** con navegador (una smart TV, un
  player de cartelería o un ordenador conectado a una tele).

---

## Paso 1 · GitHub

1. Entra en [github.com](https://github.com) y pulsa **Sign up**. Crea la cuenta con tu email.
2. Ya está: no tienes que hacer nada más aquí. Vercel copiará la ruleta en tu cuenta en el paso 2.

## Paso 2 · Vercel (publicar la ruleta y crear la base de datos)

1. Pulsa este botón:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjuliomoga%2Fruleta-optica&project-name=ruleta-premios&repository-name=ruleta-premios&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

2. Entra con tu cuenta de **GitHub** (*Continue with GitHub*) y acepta los permisos. Si es la
   primera vez, Vercel te crea la cuenta en ese momento (elige el plan **Hobby**).
3. Vercel te pide un nombre para el repositorio: deja `ruleta-premios` o pon el que quieras
   (por ejemplo `ruleta-tuoptica`; el nombre sale en la dirección web).
4. **Base de datos**: Vercel te propone crear una base **Neon**. Acepta, elige el plan gratuito
   (*Free*) y la región más cercana (*Frankfurt*), y pulsa **Create** / **Continue**. Ya está: la
   conexión se rellena sola.
5. Pulsa **Deploy** y espera un minuto. Cuando salga el confeti, pulsa **Continue to Dashboard** y
   luego **Visit** para abrirla. Esa es tu dirección.

> No tienes que crear tablas ni tocar la base de datos: la ruleta las crea sola la primera vez.

## Paso 3 · Configurar tu ruleta

1. Abre `https://tu-direccion.vercel.app/admin`. La primera vez te pide **crear la clave del
   panel**: invéntate una (mínimo 8 caracteres) y **apúntala**. Es la que usarás para entrar.
   Hazlo nada más instalar: hasta que la creas, el panel está abierto para quien tenga la dirección.

   *Si sale un error de base de datos: Vercel → tu proyecto → **Storage**. Tiene que haber una base
   Neon conectada al proyecto. Si no la hay, pulsa **Create Database → Neon** y conéctala; después,
   **Deployments** → los tres puntos del último → **Redeploy**.*

2. El panel te enseña una lista de **Primeros pasos**. En **⚙️ Ajustes**, abajo del todo:
   - **Tu óptica**: nombre, dirección, teléfono, email, horario.
   - **Datos legales**: razón social, CIF, email para ejercer derechos. Pulsa **Ver el texto que
     verá el participante** y **revísalo con tu asesor o delegado de protección de datos**. Si ya
     tienes tu propio texto, pégalo en *Texto de privacidad propio*.
   - **Evento y textos**: título, subtítulo de la pantalla (por ejemplo `FERIA 2026`), validez de
     los vales, firma del email.
   - **Sorteo final** (si quieres): actívalo y escribe el premio.
   - **Aspecto**: tu color, los colores de la rueda y cuánto tarda en girar.
   - Pulsa **💾 Guardar ajustes**.
   - **Logos**: sube tu logo alargado (cabecera) y uno cuadrado (centro de la rueda). Si tu logo es
     negro, marca *Invertir el logo en la pantalla* en Aspecto (la pantalla tiene fondo negro).
3. **Premios**: cambia los de ejemplo por los tuyos. El **peso** es la probabilidad (un premio con
   peso 20 sale el doble que uno con peso 10). El **stock** vacío es sin límite. Pulsa **Guardar**
   en cada fila.

## Paso 4 · El correo (para enviar el premio por email)

Opcional pero recomendable. Sin correo, la tablet enseña el premio y el código y el cliente le hace
una foto.

**Con Gmail** (o Google Workspace):

1. En tu cuenta de Google activa la **Verificación en dos pasos** (Cuenta de Google → Seguridad).
2. Busca **Contraseñas de aplicaciones** (en Cuenta de Google → Seguridad, o en
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)), crea una llamada
   `ruleta` y copia la contraseña de 16 letras.
3. En el panel → Ajustes → **Correo**:
   - Servidor SMTP: `smtp.gmail.com`
   - Puerto: `587`
   - Usuario: tu dirección de Gmail
   - Contraseña: la de 16 letras
   - Remitente: `Tu Óptica <tudireccion@gmail.com>`
4. **Guardar ajustes** y luego **✉️ Enviar email de prueba**. Mira la bandeja (y el spam).

**Con otro proveedor** (el correo de tu web, Outlook, IONOS…): pon los datos SMTP que te dé tu
proveedor. Normalmente el puerto es 587 o 465.

## Paso 5 · Probarlo todo

1. Abre la **pantalla**: `https://tu-direccion.vercel.app/pantalla`.
2. En el panel pulsa **🎡 Tirada de prueba**: la rueda de la pantalla gira.
3. Abre la **tablet en modo prueba** (`/tablet?prueba=1`), regístrate con tus datos y gira. Te
   tiene que llegar el email.
4. Si has activado el sorteo, prueba un **Sorteo de PRUEBA** con la pantalla abierta.
5. Cuando todo esté bien: **🗑 Borrar datos de prueba**.

## El día del evento

**La pantalla.** Abre `/pantalla` a pantalla completa en la tele o el player.
- Está diseñada para una pantalla **vertical** (como las de escaparate). En una tele horizontal
  también funciona: se ve centrada con bandas negras a los lados.
- En players de cartelería (nsign, Yodeck, Xibo…): contenido de tipo *página web / URL*, sin
  refresco automático, todo el día en la lista.
- Si pierde la conexión, sale un puntito rojo arriba a la derecha y sigue intentándolo sola.

**La tablet.** Abre `/tablet` (¡sin `?prueba=1`!).
- En iPad: Safari → Compartir → **Añadir a pantalla de inicio** (se abre sin barras). Activa el
  **Acceso guiado** (Ajustes → Accesibilidad) para que nadie salga de la página, y pon el
  **bloqueo automático en Nunca**.
- La música y los sonidos empiezan al primer toque en la pantalla. Un altavoz Bluetooth queda genial.
  Los botones 🎵 y 🔊 de arriba apagan la música o todo el sonido.

**El panel**, desde tu móvil o el ordenador: ves quién juega en directo, si le ha llegado el email,
reenvías emails, buscas un código para marcar el vale como canjeado y lanzas el sorteo final.

**Al acabar**: descarga el **CSV de participantes** (se abre con Excel). La columna
`acepta_ofertas` dice quién ha dado permiso para enviarle ofertas: **solo a esos** les puedes mandar
publicidad. Y cierra la página de la pantalla (cada consulta cuenta en el plan gratuito de Vercel).

**Para otro evento**: panel → Ajustes → **Empezar de cero** (después de descargar el CSV).

---

## Preguntas frecuentes

**¿Cuánto cuesta?** Vercel y Neon tienen planes gratuitos que de sobra dan para un evento.
Dos cosas a saber:
- **Vercel Hobby** (el gratuito) es, según sus condiciones, para uso personal y no comercial. Para
  un uso comercial, Vercel ofrece el plan **Pro**. Revisa sus condiciones y decide tú.
- La **pantalla** consulta la ruleta casi cada segundo. Durante un evento no es problema, pero no la
  dejes abierta días y días: gasta las horas gratuitas de la base de datos. Ciérrala al acabar.

**¿Puedo poner mi propio dominio?** Sí: Vercel → tu proyecto → Settings → Domains.

**¿Los datos de mis clientes los ve alguien más?** No. Están en tu base de datos (en tu cuenta de
Vercel). Quien te
regaló la ruleta no tiene acceso a nada.

**¿Puede jugar alguien dos veces?** Con el mismo móvil, no.

**Quiero cambiar la clave del panel.** Panel → Ajustes → **Clave del panel**.

**He olvidado la clave del panel.** Vercel → tu proyecto → Settings → Environment Variables →
añade `CLAVE_PANEL` con una clave nueva → Save. Después, Deployments → los tres puntos del último →
**Redeploy**. Desde ese momento la clave es esa.

**¿Cómo actualizo la ruleta si sale una versión nueva?** Copia los archivos nuevos en tu
repositorio de GitHub (o pídeselo a quien te ayude con la web): Vercel la vuelve a publicar sola y
tus participantes, premios y ajustes siguen en la base de datos.

**Algo no funciona.** Vercel → tu proyecto → **Logs**: ahí sale el error. El panel también enseña
los errores de conexión en lenguaje normal.
