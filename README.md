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
```

Gebruik voor `SESSION_SECRET` een cryptografisch willekeurige waarde van minimaal
32 tekens. Zet voor lokale ontwikkeling
`DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord-callback` en voor
productie `DISCORD_REDIRECT_URI=https://ajaxpro.fans/api/auth/discord-callback`.
Vercel Preview gebruikt een aparte preview-URL en dus een eigen redirect URI.

Voeg in het Discord Developer Portal bij **OAuth2 → Redirects** elke gebruikte URI
exact toe. Kopieer onder **General Information** de Application ID naar
`DISCORD_CLIENT_ID` en het Client Secret naar `DISCORD_CLIENT_SECRET`. Een bot of
bot-permissies zijn voor deze test niet nodig.

Stel de variabelen in Vercel per environment in. Omdat `DISCORD_REDIRECT_URI` per
omgeving verschilt, hoort de productie-URI alleen bij Production en een concrete
Vercel Preview-URI alleen bij Preview.
