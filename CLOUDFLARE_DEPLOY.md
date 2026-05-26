# Cloudflare Pages deploy (Garuga Marketplace)

This repo builds the Vite app from `client/` and publishes `client/dist` to Cloudflare Pages.

## Cloudflare Pages settings

- Project name: `garuga-marketplace`
- Production branch: `main`
- Root directory: `client`
- Build command: `npm run build`
- Build output directory: `dist`
- Custom domain target: `garuga.online`

## Manual CLI deploy

```powershell
npm --prefix client run deploy:cloudflare
```

Run `npx wrangler login` first if the CLI asks you to authenticate.

## Current connection note

Codex can read your Cloudflare account and the `garuga.online` zone, but the connected Cloudflare API token returned an authentication error when trying to create a Pages project. Give the token Cloudflare Pages edit permissions, then the command above can publish the site.
