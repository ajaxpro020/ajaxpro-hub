# AjaxPro Hub

De centrale AjaxPro-hub voor Ajax-nieuws, tools, de volgende wedstrijd en
contractinformatie.

## Hosting

De productieversie wordt automatisch vanuit `main` naar Vercel gedeployed.

- Productie: https://ajaxpro-hub.vercel.app
- Domein: https://ajaxpro.fans

## Discord-toegang en rechten

De knop **Inloggen met Discord** gebruikt Discord OAuth2 met uitsluitend de scopes
`identify` en `guilds.members.read`. De route `/club` is server-side afgeschermd en
ieder geldig lid van de AjaxPro Discord-server krijgt standaard `portal.access`.
`DISCORD_GUILD_ID` bepaalt welke Discord-server wordt gecontroleerd. Discord-rol-ID's
worden later centraal gekoppeld aan aanvullende rechten; onbekende rollen krijgen
geen aanvullende rechten.

Benodigde environment variables:

```text
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=
DISCORD_GUILD_ID=
SESSION_SECRET=
DATABASE_URL=
MOTM_MANAGER_ROLE_IDS=
MOTM_DELETE_ROLE_IDS=
```

Gebruik voor `SESSION_SECRET` een cryptografisch willekeurige waarde van minimaal
32 tekens. Zet voor lokale ontwikkeling
`DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord-callback` en voor
productie `DISCORD_REDIRECT_URI=https://ajaxpro.fans/api/auth/discord-callback`.
Vercel Preview gebruikt een aparte preview-URL en dus een eigen redirect URI.

`MOTM_MANAGER_ROLE_IDS` is een kommagescheiden lijst Discord-rol-ID's. Leden met
minimaal één van deze rollen krijgen server-side `motm.manage`. Laat de variabele
leeg om niemand beheerrechten te geven. `DATABASE_URL` wijst naar een PostgreSQL-
database die vanuit Vercel bereikbaar is (bijvoorbeeld Neon of Vercel Postgres).

Voeg in het Discord Developer Portal bij **OAuth2 → Redirects** elke gebruikte URI
exact toe. Kopieer onder **General Information** de Application ID naar
`DISCORD_CLIENT_ID` en het Client Secret naar `DISCORD_CLIENT_SECRET`. Een bot of
bot-permissies zijn voor deze test niet nodig.

Stel de variabelen in Vercel per environment in. Omdat `DISCORD_REDIRECT_URI` per
omgeving verschilt, hoort de productie-URI alleen bij Production en een concrete
Vercel Preview-URI alleen bij Preview.

## Man of the Match – fase 1

Installeer dependencies met `npm install`. Voer op een nieuwe database eerst
migratie 001 en daarna migratie 002 uit:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_motm.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_motm_scheduling.sql
```

Beide migraties zijn additief en verwijderen geen data. Migratie 001 maakt de
MOTM-tabellen en unieke beperkingen aan. Migratie 002 voegt de geplande openings-
en sluitingstijden toe. PostgreSQL moet `gen_random_uuid()` ondersteunen (dit is
standaard in moderne managed Postgres-installaties).

### Production-checklist

1. Maak of koppel een afzonderlijke Production PostgreSQL-database en stel de
   Production-waarde van `DATABASE_URL` in Vercel in.
2. Voer op die Production-database migratie 001 en daarna migratie 002 uit.
3. Stel in Vercel voor Production `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
   `DISCORD_GUILD_ID`, `SESSION_SECRET` en `MOTM_MANAGER_ROLE_IDS` in.
4. Stel `DISCORD_REDIRECT_URI=https://ajaxpro.fans/api/auth/discord-callback` alleen
   voor Production in en voeg exact die URI toe in het Discord Developer Portal.
5. Merge pas daarna naar `main`, wacht op een geslaagde Production-deployment en
   test login, beheer, stemmen, automatisch sluiten en de uitslag op het domein.

Lokaal testen:

1. Vul een niet-gecommit `.env.local` met alle bovengenoemde variabelen.
2. Voer `npm test` uit voor de TypeScript-controle.
3. Start de Vercel-omgeving met `npx vercel dev`.
4. Log in via Discord en open `/club`.

Een gebruiker met `motm.manage` maakt via `/club/motm/nieuw` een concept of open
stemming, selecteert de wedstrijdspelers en deelt daarna de stabiele stemlink. De
next-match-bron vult het formulier als voorstel; handmatig invullen blijft altijd
mogelijk. Een geldig Discord-serverlid stemt via `/club/stemmen/{slug}`. De unieke
databasebeperking werkt een bestaande stem bij in plaats van een tweede record te
maken. Na sluiten toont dezelfde URL de server-side berekende winnaar en top drie.

Fase 2 bevat pas de Ajacied-van-het-jaar-punten, seizoenranglijst, persoonlijke
stemhistorie, botberichten, notificaties en uitgebreid beheer. Het `season`-veld is
nu al aanwezig om die uitbreiding mogelijk te maken.
