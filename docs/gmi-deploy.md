# Deploy ReVibe on GMI Cloud

Status: plan only. Do this after the demo path works on localhost. Keep localhost as the stage backup.

## What the account has (read-only checks, 6 November 2026)

- API base: `https://console.gmicloud.ai/api`. Auth: `Authorization: Bearer <GMI_CE_API_KEY>` (scope `ce_resource`).
- Container product: `gmi.container.intel.x4660.large` (CPU, no GPU) in IDC `us-central-iowa1`. The API lists its price as `47500`. Confirm the unit in the console before you create anything.
- Official templates: `gmicloud-jupyterlab` (`beaab7d0-0c88-485f-be38-700cb4c93967`), `gmicloud-vllm-with-jupyterlab`, `gmicloud-sglang-with-jupyterlab`, `gmicloudai-llama3-inference`.
- Running containers: none.
- Official templates open port 22 (SSH) and port 8888 (Jupyter). Custom templates open no ports by default.
- Local tools: Docker 29.7, OpenSSH 10.3, key `~/.ssh/id_ed25519.pub`.

## Plan A: official template and SSH (no registry needed)

1. Build locally: `npm run build` with `output: "standalone"` in `next.config.ts`.
2. Create one container from `gmicloud-jupyterlab` with product `gmi.container.intel.x4660.large` in `us-central-iowa1`. Pass the SSH public key as the `SSH_KEY` env value.
3. Poll `GET /v1/containers/{id}` until the status is `Running`. Read the SSH command from the console.
4. Copy `.next/standalone`, `.next/static`, `public`, and `data/` to the container with `scp`.
5. Install Node 20 or newer in the container. Set `GMI_API_KEY`, `GMI_MODEL`, `ORIANE_API_KEY` and `REVIBE_OFFLINE` in the shell, not in files.
6. Serve the app on port 8888: stop Jupyter, then run `PORT=8888 HOSTNAME=0.0.0.0 node server.js`.
7. Open the 8888 port link from the console. Check `/api/health`, then run the example path.

## Plan B: custom template with a Docker image

Use this only if Plan A fails. It needs a public registry account (Docker Hub or GHCR) and a `docker login` by the owner.

1. Build an image from a standalone Dockerfile. Push it to the registry.
2. `POST /v1/templates` with the image and a port mapping for 3000.
3. Create the container from that template. Attach a firewall rule and, if needed, an elastic IP for port 3000.

## Rules

- Ask before you create, restart or delete any container: each one uses credits.
- Never write keys into the image or the repo. Pass them as runtime environment variables.
- Delete the container after the event.
