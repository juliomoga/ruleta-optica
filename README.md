# 🎡 Ruleta de premios para ópticas

Una ruleta de premios para ferias, aniversarios, inauguraciones o cualquier evento en tu óptica.

- **La pantalla** (una tele o la pantalla del escaparate) enseña la rueda grande.
- **La tablet** (un iPad en la puerta): el cliente pone su nombre, su móvil y su email, acepta la
  protección de datos, firma con el dedo y pulsa **¡GIRAR!**. La rueda gira a la vez en la tablet y
  en la pantalla.
- **El premio** le llega por email con un código para canjearlo en la óptica.
- **El panel** te deja cambiar premios, probabilidades y stock, ver quién ha jugado, marcar los vales
  canjeados y descargar los contactos en Excel (CSV).
- **Sorteo final** (opcional): al acabar el evento sorteas un premio gordo entre todos los
  participantes, en directo en la pantalla, con cuenta atrás y redoble.

Funciona en internet (no depende de la red de la tienda) y se instala **gratis** en tus propias
cuentas de GitHub y Vercel, con un botón: la base de datos (Neon) la crea Vercel sola. Los datos de
tus clientes quedan en **tu** cuenta: nadie más los ve.

## Instalar

📄 **Guía en PDF con capturas, paso a paso:** https://optometria.ai/descargas/ruleta-premios

👉 **Sigue la [guía paso a paso](GUIA.md)** (unos 15 minutos, no hace falta saber programar).

Resumen para quien ya conoce Vercel:

1. Pulsa el botón y acepta crear la base **Neon** (plan gratuito):

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjuliomoga%2Fruleta-optica&project-name=ruleta-premios&repository-name=ruleta-premios&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

2. Entra en `https://tu-proyecto.vercel.app/admin` y crea la clave del panel (la primera vez la
   pide). Las tablas se crean solas. Rellena los ajustes (tu óptica, datos legales, logo, correo) y
   cambia los premios.

## Páginas

| Página | Para qué |
|---|---|
| `/pantalla` | La rueda grande, diseñada para pantalla vertical (384×768). En otras pantallas se escala sola. |
| `/tablet` | Registro y botón de girar. Con sonido y música de fondo. |
| `/tablet?prueba=1` | Igual, pero los registros quedan como prueba (no gastan stock y se borran desde el panel). |
| `/admin` | El panel. |

## Cómo está hecha

Páginas HTML sin frameworks + funciones de Vercel (Node) + Postgres (Neon, creado por Vercel al instalar).

```
 Tablet (/tablet) ──registrar / girar / enviar──▶  Vercel /api/*  ──▶  Postgres (Neon, esquema "ruleta")
                                                        ▲
 Pantalla (/pantalla) ──── /api/estado cada 0,8 s ──────┘
```

- El premio se elige **en el servidor** (`ruleta.girar`: azar por pesos entre los premios con stock,
  con bloqueo para que dos tiradas a la vez no den uno de más).
- Un teléfono solo juega una vez.
- La pantalla solo hace peticiones GET (vale cualquier navegador de player o smart TV) y se recarga
  sola cuando despliegas una versión nueva.
- Los ajustes, los textos y los logos se guardan en la base (`ruleta.ajustes`) y se editan en el
  panel; no hay que tocar código.
- El esquema se instala y actualiza solo (`api/_esquema.js`).

Variables de entorno:

| Variable | |
|---|---|
| `DATABASE_URL` | Conexión a Postgres. La pone sola la integración de Neon. Vale cualquier Postgres (también `POSTGRES_URL`); con Supabase, usa la conexión *Transaction pooler* (puerto 6543). |
| `CLAVE_PANEL` | Opcional. La clave del panel se crea en `/admin` la primera vez y se guarda cifrada en la base; si pones esta variable, manda ella (sirve para recuperar el panel si se olvida la clave). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Opcionales: el correo también se configura desde el panel. Si están, mandan. |

### Probar en tu ordenador

```bash
cp .env.example .env      # y rellénalo
npm install
npm run local             # http://localhost:3210/pantalla · /tablet · /admin
```

## Música

La tablet trae una marcha de circo sintetizada (composición propia). Si pones un mp3 en
`public/audio/ambiente.mp3` suena ese en bucle. Ojo: la música comercial en un local necesita
licencia (SGAE/AGEDI); usa música libre de derechos.

## Aviso

Se regala tal cual, sin garantía de ningún tipo (licencia MIT). Cada óptica es la responsable de los
datos de sus clientes: revisa el texto de privacidad con tu asesor o delegado de protección de datos,
y consulta con tu gestoría si tu sorteo necesita bases o tasa.

Hecha por Julio Moreno (Ópticas Florida y [@optometria.ai](https://www.instagram.com/optometria.ai)).
